import re
import time
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.dialects.postgresql import insert as pg_insert
from database import SessionLocal, engine
from models import Manga, Chapter
from services.mal import get_top_manga
from scrapers.mangafreak import search_manga as mf_search, get_chapters

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


def refresh_stale_chapters():
    """
    Re-scrape chapters for manga whose cache is older than CHAPTER_STALE_DAYS.
    Also runs gap detection to find and fill missing chapters within existing ranges.
    Uses INSERT ON CONFLICT DO NOTHING so concurrent web-request inserts are safe.
    """
    print("Scheduler: Checking for stale chapters and gaps...")
    db = SessionLocal()
    try:
        stale_cutoff = datetime.utcnow() - timedelta(days=CHAPTER_STALE_DAYS)
        manga_list = db.query(Manga).filter(Manga.available == True).all()
        refreshed = 0
        total_gaps_filled = 0

        for manga in manga_list:
            try:
                latest_chapter = (
                    db.query(Chapter)
                    .filter(Chapter.manga_id == manga.id)
                    .order_by(Chapter.cached_at.desc())
                    .first()
                )

                # Skip if cache is still fresh
                if latest_chapter and latest_chapter.cached_at and latest_chapter.cached_at > stale_cutoff:
                    continue

                print(f"[Scheduler] Checking: {manga.title}")
                from routes import search_mangafreak_with_fallback
                results = search_mangafreak_with_fallback(manga.title)

                if not results:
                    print(f"[Scheduler] Still not found on MangaFreak: {manga.title}")
                    continue

                fresh_chapters = get_chapters(results[0]["url"])
                if not fresh_chapters:
                    continue

                # Fetch existing chapters fresh from DB right before inserting
                cached_chapters = (
                    db.query(Chapter)
                    .filter(Chapter.manga_id == manga.id)
                    .all()
                )
                existing_urls = {c.source_url for c in cached_chapters}

                max_cached_num = max(
                    (_extract_chapter_num(ch.chapter_number) for ch in cached_chapters),
                    default=-1
                )

                # New chapters beyond what we have
                new_chapters = [
                    c for c in fresh_chapters
                    if c["source_url"] not in existing_urls
                    and _extract_chapter_num(c["chapter_number"]) > max_cached_num
                ]

                # Gap chapters within our existing range
                gap_chapters = find_gaps(cached_chapters, fresh_chapters, existing_urls)

                now = datetime.utcnow()

                # Build insert payloads — ON CONFLICT DO NOTHING handles races
                rows_to_insert = []
                for c in new_chapters:
                    rows_to_insert.append({
                        "manga_id": manga.id,
                        "chapter_number": c["chapter_number"],
                        "title": c["title"],
                        "source_url": c["source_url"],
                        "cached_at": now,
                    })
                for c in gap_chapters:
                    rows_to_insert.append({
                        "manga_id": manga.id,
                        "chapter_number": c["chapter_number"],
                        "title": c["title"],
                        "source_url": c["source_url"],
                        "cached_at": now,
                    })

                inserted = _upsert_chapters(db, rows_to_insert)

                # Update cached_at on all existing chapters AFTER the inserts are
                # flushed, so autoflush doesn't fire mid-insert and cause conflicts.
                db.query(Chapter).filter(Chapter.manga_id == manga.id).update(
                    {"cached_at": now}
                )

                db.commit()
                refreshed += 1

                new_count = len(new_chapters)
                gap_count = len(gap_chapters)
                total_gaps_filled += gap_count

                if gap_count > 0:
                    print(f"[Gap Fill] {manga.title}: filled {gap_count} missing chapter(s)")
                if new_count > 0:
                    print(f"[Scheduler] {manga.title}: +{new_count} new chapter(s)")
                if gap_count == 0 and new_count == 0:
                    print(f"[Scheduler] {manga.title}: up to date")

                time.sleep(1)

            except Exception as e:
                db.rollback()
                print(f"[Scheduler] Failed refreshing {manga.title}: {e}")

        print(f"Scheduler: Done! ({refreshed} manga checked, {total_gaps_filled} gaps filled)")
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