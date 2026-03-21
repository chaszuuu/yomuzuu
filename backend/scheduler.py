import re
import time
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.dialects.postgresql import insert as pg_insert
from database import SessionLocal, engine
from models import Manga, Chapter
from services.mal import get_top_manga
from services.mangadex import search_manga as md_search, get_chapters as md_get_chapters
from scrapers.mangafreak import search_manga as mf_search, get_chapters as mf_get_chapters
from scrapers.asura import search_manga as asura_search, get_chapters as asura_get_chapters

CHAPTER_STALE_DAYS = 1


def update_mal():
    print("Scheduler: Fetching top manga from MAL API...")
    db = SessionLocal()
    try:
        manga_list = get_top_manga(limit=50, offset=0)

        if not manga_list:
            print("[Scheduler] MAL API returned no results")
            return

        for data in manga_list:
            try:
                if not data.get("title"):
                    continue

                existing = db.query(Manga).filter(Manga.source_url == data["source_url"]).first()
                if existing:
                    existing.title = data["title"]
                    existing.score = data["score"]
                    existing.description = data["description"]
                    existing.genres = data["genres"]
                    existing.cover = data["cover"]
                    existing.type = data["type"]
                    existing.status = _mal_status(data.get("status"))
                    print(f"[Scheduler] Updated: {data['title']}")
                else:
                    db.add(Manga(
                        title=data["title"],
                        cover=data["cover"],
                        description=data["description"],
                        genres=data["genres"],
                        score=data["score"],
                        type=data["type"],
                        source_url=data["source_url"]
                    ))
                    print(f"[Scheduler] Added: {data['title']}")

                db.commit()

            except Exception as e:
                db.rollback()
                print(f"[Scheduler] Failed for {data.get('title', 'unknown')}: {e}")

    finally:
        db.close()
    print("Scheduler: MAL update done!")


def _extract_chapter_num(chapter_number_str):
    """Convert chapter string like '51a', '51.5' to float. Returns -1 if unparseable."""
    if not chapter_number_str:
        return -1
    try:
        cleaned = re.sub(r"[a-zA-Z]+$", "", str(chapter_number_str))
        return float(cleaned)
    except (ValueError, TypeError):
        return -1


def find_gaps(cached_chapters, fresh_chapters, cached_urls):
    """
    Returns fresh chapters that are missing from the cache AND fall within
    the min-max range we already have (true gaps, not new releases).
    """
    if not cached_chapters or not fresh_chapters:
        return []

    cached_nums = {
        _extract_chapter_num(c.chapter_number)
        for c in cached_chapters
        if _extract_chapter_num(c.chapter_number) != -1
    }

    if not cached_nums:
        return []

    min_cached = min(cached_nums)
    max_cached = max(cached_nums)

    gaps = []
    for chapter in fresh_chapters:
        if chapter["source_url"] in cached_urls:
            continue
        num = _extract_chapter_num(chapter["chapter_number"])
        if num == -1:
            continue
        if min_cached <= num <= max_cached:
            gaps.append(chapter)

    return gaps


def _upsert_chapters(db, chapters_to_insert):
    """
    Insert chapters using PostgreSQL INSERT ... ON CONFLICT DO NOTHING.
    This is fully race-safe — concurrent inserts from web requests won't
    cause UniqueViolation errors. Returns the number of rows inserted.
    """
    if not chapters_to_insert:
        return 0

    stmt = pg_insert(Chapter.__table__).values(chapters_to_insert)
    stmt = stmt.on_conflict_do_nothing(index_elements=["source_url"])

    result = db.execute(stmt)
    return result.rowcount


def _mal_status(mal_status_str):
    """Normalize MAL status string to ONGOING/COMPLETED."""
    if not mal_status_str:
        return "ONGOING"
    s = mal_status_str.lower()
    if "finish" in s or "complete" in s:
        return "COMPLETED"
    return "ONGOING"


def _search_source(search_fn, title, label):
    from routes import clean_title, best_match
    attempts = [title, clean_title(title)]
    words = clean_title(title).split()
    if len(words) > 2:
        attempts.append(" ".join(words[:3]))
    if len(words) > 1:
        attempts.append(words[0])
    seen = set()
    attempts = [a for a in attempts if a and not (a in seen or seen.add(a))]
    for attempt in attempts:
        try:
            results = search_fn(attempt)
            if results:
                match = best_match(results, title)
                if match:
                    return match
        except Exception as e:
            print(f"[Scheduler] {label} error for '{attempt}': {e}")
    return None


def _merge_chapters(md_chapters, mf_chapters, asura_chapters):
    """
    Merge three chapter lists.
    Priority: MangaFreak (base) -> MangaDex -> Asura (wins, most complete English)
    """
    merged = {}
    for c in mf_chapters:
        merged[c["chapter_number"]] = {**c, "source": "mangafreak"}
    for c in md_chapters:
        merged[c["chapter_number"]] = {**c, "source": "mangadex"}
    for c in asura_chapters:
        merged[c["chapter_number"]] = {**c, "source": "asura"}
    return list(merged.values())


def refresh_stale_chapters():
    """
    Re-sync chapters for ONGOING manga whose cache is stale.
    Uses both MangaDex (primary) and MangaFreak (gap fill), merges results.
    Skips COMPLETED manga — they don't get new chapters.
    """
    print("Scheduler: Checking for stale chapters and gaps...")
    db = SessionLocal()
    try:
        stale_cutoff = datetime.utcnow() - timedelta(days=CHAPTER_STALE_DAYS)
        manga_list = db.query(Manga).filter(
            Manga.available == True,
            Manga.status != "COMPLETED"          # skip finished manga
        ).all()
        refreshed = 0
        total_new = 0

        for manga in manga_list:
            try:
                latest_chapter = (
                    db.query(Chapter)
                    .filter(Chapter.manga_id == manga.id)
                    .order_by(Chapter.cached_at.desc())
                    .first()
                )

                if latest_chapter and latest_chapter.cached_at and latest_chapter.cached_at > stale_cutoff:
                    continue

                print(f"[Scheduler] Syncing: {manga.title}")

                md_match = _search_source(md_search, manga.title, "MangaDex")
                mf_match = _search_source(mf_search, manga.title, "MangaFreak")
                asura_match = _search_source(asura_search, manga.title, "Asura")

                if not md_match and not mf_match and not asura_match:
                    print(f"[Scheduler] Not found on any source: {manga.title}")
                    continue

                md_chapters, mf_chapters, asura_chapters = [], [], []

                if md_match:
                    try:
                        md_chapters = md_get_chapters(md_match["url"])
                    except Exception as e:
                        print(f"[Scheduler] MangaDex chapters failed: {e}")

                if mf_match:
                    try:
                        mf_chapters = mf_get_chapters(mf_match["url"])
                    except Exception as e:
                        print(f"[Scheduler] MangaFreak chapters failed: {e}")

                if asura_match:
                    try:
                        asura_chapters = asura_get_chapters(asura_match["url"])
                    except Exception as e:
                        print(f"[Scheduler] Asura chapters failed: {e}")

                fresh_chapters = _merge_chapters(md_chapters, mf_chapters, asura_chapters)
                if not fresh_chapters:
                    continue

                cached_chapters = db.query(Chapter).filter(Chapter.manga_id == manga.id).all()
                existing_urls = {c.source_url for c in cached_chapters}

                max_cached_num = max(
                    (_extract_chapter_num(ch.chapter_number) for ch in cached_chapters),
                    default=-1
                )

                new_chapters = [
                    c for c in fresh_chapters
                    if c["source_url"] not in existing_urls
                    and _extract_chapter_num(c["chapter_number"]) > max_cached_num
                ]

                gap_chapters = find_gaps(cached_chapters, fresh_chapters, existing_urls)

                now = datetime.utcnow()
                rows_to_insert = []
                for c in new_chapters + gap_chapters:
                    rows_to_insert.append({
                        "manga_id": manga.id,
                        "chapter_number": c["chapter_number"],
                        "title": c["title"],
                        "source_url": c["source_url"],
                        "source": c.get("source", "mangadex"),
                        "cached_at": now,
                    })

                inserted = _upsert_chapters(db, rows_to_insert)

                db.query(Chapter).filter(Chapter.manga_id == manga.id).update({"cached_at": now})
                db.query(Manga).filter(Manga.id == manga.id).update({"last_synced_at": now})
                db.commit()

                refreshed += 1
                total_new += inserted

                if gap_chapters:
                    print(f"[Gap Fill] {manga.title}: filled {len(gap_chapters)} gap(s)")
                if new_chapters:
                    print(f"[Scheduler] {manga.title}: +{len(new_chapters)} new chapter(s)")
                if not gap_chapters and not new_chapters:
                    print(f"[Scheduler] {manga.title}: up to date")

                time.sleep(1)

            except Exception as e:
                db.rollback()
                print(f"[Scheduler] Failed refreshing {manga.title}: {e}")

        print(f"Scheduler: Done! ({refreshed} manga synced, {total_new} new chapters)")
    finally:
        db.close()


def run_all():
    update_mal()
    refresh_stale_chapters()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_all, "interval", hours=12)
    scheduler.start()
    print("Scheduler started — updates every 12 hours")
    return scheduler