import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from functools import wraps
from flask import Blueprint, jsonify, request
from sqlalchemy import Float, func
from database import SessionLocal
from models import Manga, Chapter, Page
from services.mal import search_manga as mal_search
from services.mangadex import (
    search_manga as md_search,
    get_chapters as md_get_chapters,
    get_pages as md_get_pages,
)
from scrapers.mangafreak import (
    search_manga as mf_search,
    get_chapters as mf_get_chapters,
    get_pages as mf_get_pages,
)
from scrapers.asura import (
    search_manga as asura_search,
    get_chapters as asura_get_chapters,
    get_pages as asura_get_pages,
)

bp = Blueprint("routes", __name__)

# ─── Config ──────────────────────────────────────────────────────────────────

API_KEY = os.environ.get("API_KEY", "")
CHAPTER_SYNC_INTERVAL_HOURS = 24
PREFETCH_AHEAD = 3

# ─── Auth ────────────────────────────────────────────────────────────────────

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if API_KEY:
            key = request.headers.get("X-API-Key") or request.args.get("api_key")
            if key != API_KEY:
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


# ─── Title Matching ──────────────────────────────────────────────────────────

def clean_title(title):
    cleaned = re.sub(r"\s*\(.*?\)", "", title).strip()
    cleaned = re.sub(r"\s*:.*$", "", cleaned).strip()
    return cleaned


def normalize(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _words(text):
    """Split title into words, stripping possessives and punctuation first."""
    text = re.sub(r"'s\b", "", text.lower())
    return set(re.sub(r"[^a-z0-9\s]", "", text).split())


def best_match(results, title, min_score=2, alt_title=None):
    target = normalize(clean_title(title))
    alt_target = normalize(clean_title(alt_title)) if alt_title else None

    def score(result):
        r_raw = result["title"].lower()
        r = normalize(result["title"])
        r_words = set(re.sub(r"[^a-z0-9\s]", "", result["title"].lower()).split())

        t = target
        if r == t:
            return 4
        if r_raw == clean_title(title).lower():
            return 3
        if r.startswith(t) or t.startswith(r):
            return 2
        if t in r or r in t:
            return 1
        t_words = set(re.sub(r"[^a-z0-9\s]", "", clean_title(title).lower()).split())
        if len(t_words & r_words) >= 2:
            return 1

        if alt_target:
            a = alt_target
            if r == a:
                return 4
            if r_raw == clean_title(alt_title).lower():
                return 3
            if r.startswith(a) or a.startswith(r):
                return 2
            if a in r or r in a:
                return 1
            a_words = set(re.sub(r"[^a-z0-9\s]", "", clean_title(alt_title).lower()).split())
            if len(a_words & r_words) >= 2:
                return 1

        return 0

    scored = sorted(results, key=score, reverse=True)
    best = scored[0]
    if score(best) < min_score:
        print(f"[Search] No good match found (best was '{best['title']}')")
        return None
    print(f"[Search] Best match: '{best['title']}'")
    return best


def _search_source(search_fn, title, label, min_score=2, alt_title=None):
    attempts = [title, clean_title(title)]
    words = clean_title(title).split()
    if len(words) > 4:
        attempts.append(" ".join(words[:3]))
    # removed single-word fallback — too ambiguous

    if alt_title and alt_title != title:
        attempts.append(alt_title)
        alt_clean = clean_title(alt_title)
        if alt_clean != alt_title:
            attempts.append(alt_clean)

    seen = set()
    attempts = [a for a in attempts if a and not (a in seen or seen.add(a))]

    for attempt in attempts:
        is_truncated = attempt != title and attempt != clean_title(title) and attempt != alt_title
        effective_min_score = min_score + 1 if is_truncated else min_score
        print(f"[Search] Trying {label} with: '{attempt}'")
        try:
            results = search_fn(attempt)
            if results:
                match = best_match(results, title, min_score=effective_min_score, alt_title=alt_title)
                if match:
                    return match
        except Exception as e:
            print(f"[Search] {label} error for '{attempt}': {e}")

    print(f"[Search] {label}: no match found for '{title}'")
    return None


def _extract_chapter_num(s):
    if not s:
        return -1
    try:
        return float(re.sub(r"[a-zA-Z]+$", "", str(s)))
    except (ValueError, TypeError):
        return -1


# ─── Chapter Title Normalization ─────────────────────────────────────────────

def _normalize_chapter_title(chapter_number, title):
    if not title or title.strip() == "":
        return f"Chapter {chapter_number}"
    if re.search(r'\b' + re.escape(str(chapter_number)) + r'\b', title):
        return title
    if re.match(r'^chapter\s+[\d.]+$', title.strip(), re.IGNORECASE):
        return f"Chapter {chapter_number}"
    return f"Chapter {chapter_number} - {title}"


def _is_weak_title(title, chapter_number):
    return bool(re.match(r'^Chapter\s+' + re.escape(str(chapter_number)) + r'$', title or '', re.IGNORECASE))


# ─── Chapter Merging ─────────────────────────────────────────────────────────

def fetch_and_merge_chapters(manga_title, manga_id, db, alt_title=None):
    has_alt = bool(alt_title)
    md_match    = _search_source(md_search,    manga_title, "MangaDex",   min_score=1 if has_alt else 2, alt_title=alt_title)
    mf_match    = _search_source(mf_search,    manga_title, "MangaFreak", min_score=1, alt_title=alt_title)
    asura_match = _search_source(asura_search, manga_title, "Asura",      min_score=1, alt_title=alt_title)

    # ── Validate Asura match against confirmed source ──────────────────────
    # If MD or MF found the manga, use their title to verify Asura's match.
    # Also check overlap against the original manga_title — the same manga
    # can have different English titles across sources (different translators).
    # Use _words() to strip possessives before comparing so "Mercenary's"
    # matches "Mercenary".
    if asura_match and (md_match or mf_match):
        confirmed_title = (md_match or mf_match)["title"]
        asura_title     = asura_match["title"]
        stop_words      = {"the", "a", "an", "of", "in", "to", "and", "as", "is", "i"}

        confirmed_words = _words(confirmed_title) - stop_words
        asura_words     = _words(asura_title)     - stop_words
        manga_words     = _words(manga_title)     - stop_words

        overlap_confirmed = len(confirmed_words & asura_words)
        overlap_original  = len(manga_words      & asura_words)

        if overlap_confirmed < 2 and overlap_original < 2:
            print(f"[Merge] Rejecting Asura match '{asura_title}' — conflicts with confirmed title '{confirmed_title}'")
            asura_match = None

    if not md_match and not mf_match and not asura_match:
        print(f"[Merge] No sources found for: {manga_title}")
        return 0

    md_chapters    = []
    mf_chapters    = []
    asura_chapters = []

    if md_match:
        try:
            md_chapters = md_get_chapters(md_match["url"])
            print(f"[Merge] MangaDex: {len(md_chapters)} chapters")
        except Exception as e:
            print(f"[Merge] MangaDex get_chapters failed: {e}")

    if mf_match:
        try:
            mf_chapters = mf_get_chapters(mf_match["url"])
            print(f"[Merge] MangaFreak: {len(mf_chapters)} chapters")
        except Exception as e:
            print(f"[Merge] MangaFreak get_chapters failed: {e}")

    if asura_match:
        try:
            asura_chapters = asura_get_chapters(asura_match["url"])
            print(f"[Merge] Asura: {len(asura_chapters)} chapters")
        except Exception as e:
            print(f"[Merge] Asura get_chapters failed: {e}")

    merged = {}
    for c in md_chapters:
        merged[c["chapter_number"]] = {**c, "source": "mangadex"}
    for c in mf_chapters:
        merged[c["chapter_number"]] = {**c, "source": "mangafreak"}
    for c in asura_chapters:
        merged[c["chapter_number"]] = {**c, "source": "asura"}

    if not merged:
        return 0

    existing_chapters  = db.query(Chapter).filter(Chapter.manga_id == manga_id).all()
    existing_urls      = {c.source_url for c in existing_chapters}
    existing_by_number = {c.chapter_number: c for c in existing_chapters}

    now = datetime.utcnow()
    new_count = 0
    for c in merged.values():
        if c["source_url"] in existing_urls:
            continue

        if c["chapter_number"] in existing_by_number:
            existing = existing_by_number[c["chapter_number"]]
            if _is_weak_title(existing.title, c["chapter_number"]):
                new_title = _normalize_chapter_title(c["chapter_number"], c["title"])
                if not _is_weak_title(new_title, c["chapter_number"]):
                    db.query(Chapter).filter(Chapter.id == existing.id).update({"title": new_title})
                    print(f"[Merge] Updated title for chapter {c['chapter_number']}: {new_title}")
            continue

        db.add(Chapter(
            manga_id=manga_id,
            chapter_number=c["chapter_number"],
            title=_normalize_chapter_title(c["chapter_number"], c["title"]),
            source_url=c["source_url"],
            source=c["source"],
            cached_at=now,
        ))
        new_count += 1

    db.query(Manga).filter(Manga.id == manga_id).update({"last_synced_at": now})
    db.commit()

    print(f"[Merge] Inserted {new_count} new chapters for manga {manga_id}")
    return new_count


def _is_stale(manga):
    if manga.status == "COMPLETED":
        return False
    if manga.last_synced_at is None:
        return True
    cutoff = datetime.utcnow() - timedelta(hours=CHAPTER_SYNC_INTERVAL_HOURS)
    return manga.last_synced_at < cutoff


# ─── Page Fetching ───────────────────────────────────────────────────────────

def _fetch_pages_for_chapter(chapter):
    source = chapter.source or (
        "mangadex" if "mangadex.org" in chapter.source_url
        else "asura" if "asurascans.com" in chapter.source_url
        else "mangafreak"
    )

    if source == "mangadex":
        primary_fn = md_get_pages
        fallbacks = [
            ("Asura", "asura", asura_search, asura_get_chapters, asura_get_pages),
            ("MangaFreak", "mangafreak", mf_search, mf_get_chapters, mf_get_pages),
        ]
    elif source == "asura":
        primary_fn = asura_get_pages
        fallbacks = [
            ("MangaDex", "mangadex", md_search, md_get_chapters, md_get_pages),
            ("MangaFreak", "mangafreak", mf_search, mf_get_chapters, mf_get_pages),
        ]
    else:
        primary_fn = mf_get_pages
        fallbacks = [
            ("Asura", "asura", asura_search, asura_get_chapters, asura_get_pages),
            ("MangaDex", "mangadex", md_search, md_get_chapters, md_get_pages),
        ]

    try:
        pages = primary_fn(chapter.source_url)
        if pages:
            return pages, source
    except Exception as e:
        print(f"[Pages] {source} failed for chapter {chapter.id}: {e}")

    db = SessionLocal()
    manga = db.query(Manga).filter(Manga.id == chapter.manga_id).first()
    db.close()

    if not manga:
        return [], source

    alt_title = getattr(manga, "alt_title", None)

    for fallback_label, fallback_source, fallback_search_fn, fallback_chapters_fn, fallback_fn in fallbacks:
        print(f"[Pages] Falling back to {fallback_label} for chapter {chapter.id}")
        try:
            match = _search_source(fallback_search_fn, manga.title, fallback_label, alt_title=alt_title)
            if not match:
                continue

            fallback_chapters = fallback_chapters_fn(match["url"])
            matched_chapter = next(
                (c for c in fallback_chapters if c["chapter_number"] == chapter.chapter_number),
                None
            )
            if not matched_chapter:
                print(f"[Pages] {fallback_label} has no chapter {chapter.chapter_number}")
                continue

            pages = fallback_fn(matched_chapter["source_url"])
            if pages:
                try:
                    db = SessionLocal()
                    db.query(Chapter).filter(Chapter.id == chapter.id).update({
                        "source_url": matched_chapter["source_url"],
                        "source": fallback_source,
                    })
                    db.commit()
                    print(f"[Pages] Fallback success via {fallback_label}, updated chapter source")
                except Exception as update_err:
                    db.rollback()
                    print(f"[Pages] Skipping source update (conflict): {update_err}")
                finally:
                    db.close()
                return pages, fallback_source

        except Exception as e:
            print(f"[Pages] Fallback {fallback_label} failed: {e}")
            continue

    return [], source


# ─── Prefetch ────────────────────────────────────────────────────────────────

def _fetch_and_cache_pages(manga_id, chapter_id):
    db = SessionLocal()
    try:
        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            return
        if db.query(Page).filter(Page.chapter_id == chapter.id).count() > 0:
            return

        print(f"[Prefetch] Fetching pages for chapter {chapter_id}")
        pages_data, _ = _fetch_pages_for_chapter(chapter)
        if not pages_data:
            return

        for p in pages_data:
            db.add(Page(
                chapter_id=chapter.id,
                page_number=p["page_number"],
                image_url=p["image_url"]
            ))
        db.commit()
        print(f"[Prefetch] Cached {len(pages_data)} pages for chapter {chapter_id}")
    except Exception as e:
        print(f"[Prefetch] Failed for chapter {chapter_id}: {e}")
    finally:
        db.close()


def prefetch_next_chapters(manga_id, current_chapter_id):
    try:
        db = SessionLocal()
        chapters = (
            db.query(Chapter)
            .filter(Chapter.manga_id == manga_id)
            .order_by(func.nullif(func.regexp_replace(Chapter.chapter_number, '[^0-9.]', '', 'g'), '').cast(Float).nullsfirst())
            .all()
        )
        db.close()

        ids = [c.id for c in chapters]
        if current_chapter_id not in ids:
            return

        idx = ids.index(current_chapter_id)
        upcoming = chapters[idx + 1: idx + 1 + PREFETCH_AHEAD]

        for chapter in upcoming:
            thread = threading.Thread(
                target=_fetch_and_cache_pages,
                args=(manga_id, chapter.id),
                daemon=True
            )
            thread.start()

        if upcoming:
            print(f"[Prefetch] Queued {len(upcoming)} chapters ahead")
    except Exception as e:
        print(f"[Prefetch] Error: {e}")


def _background_resync(manga_id, manga_title, alt_title=None):
    db = SessionLocal()
    try:
        print(f"[Resync] Background re-sync for: {manga_title}")
        fetch_and_merge_chapters(manga_title, manga_id, db, alt_title=alt_title)
    except Exception as e:
        print(f"[Resync] Failed for {manga_title}: {e}")
    finally:
        db.close()


# ─── Search Helpers ───────────────────────────────────────────────────────────

def _score_against_query(title, alt_title, query):
    """Score a title against the search query. Returns 0-4."""
    q = normalize(query)
    t = normalize(title or "")
    a = normalize(alt_title or "")
    q_words = set(re.sub(r"[^a-z0-9\s]", "", query.lower()).split())
    t_words = set(re.sub(r"[^a-z0-9\s]", "", (title or "").lower()).split())
    a_words = set(re.sub(r"[^a-z0-9\s]", "", (alt_title or "").lower()).split())

    if t == q or a == q:
        return 4
    if t.startswith(q) or q.startswith(t) or (a and (a.startswith(q) or q.startswith(a))):
        return 3
    if q in t or t in q or (a and (q in a or a in q)):
        return 2
    if len(q_words & t_words) >= 2 or (a_words and len(q_words & a_words) >= 2):
        return 1
    return 0


def _save_manga_data(db, data, source="mal"):
    """Save manga data to DB. Returns the saved/existing manga or None."""
    try:
        if not data.get("title") or not data.get("source_url"):
            return None
        already = db.query(Manga).filter(
            (Manga.source_url == data["source_url"]) | (Manga.title == data["title"])
        ).first()
        if not already:
            manga = Manga(
                title=data["title"],
                alt_title=data.get("alt_title"),
                cover=data["cover"],
                description=data["description"],
                genres=data["genres"],
                score=data["score"],
                type=data["type"],
                source_url=data["source_url"],
                status="ONGOING",
            )
            db.add(manga)
            db.commit()
            print(f"[Search] Saved from {source}: {data['title']}")
            return manga
        else:
            if not already.alt_title and data.get("alt_title"):
                db.query(Manga).filter(Manga.id == already.id).update({
                    "alt_title": data["alt_title"]
                })
                db.commit()
            return already
    except Exception as e:
        print(f"[Search] Failed saving {data.get('title')}: {e}")
        return None


def _parse_mangadex_as_manga(md_result):
    """Convert a MangaDex search result into the same dict shape as MAL results."""
    if not md_result:
        return None
    return {
        "title": md_result.get("title"),
        "cover": md_result.get("cover"),
        "description": md_result.get("description"),
        "genres": md_result.get("genres"),
        "score": md_result.get("score"),
        "type": md_result.get("type", "manga"),
        "source_url": md_result.get("url"),
        "alt_title": md_result.get("alt_title"),
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@bp.route("/api/manga")
def get_manga():
    db = SessionLocal()
    try:
        manga_list = db.query(Manga).filter(Manga.available == True).all()
        return jsonify([{
            "id": m.id,
            "title": m.title,
            "cover": m.cover,
            "genres": m.genres,
            "score": m.score,
            "type": m.type,
            "description": m.description,
            "status": m.status,
        } for m in manga_list])
    except Exception as e:
        print(f"[Error] /api/manga: {e}")
        return jsonify({"error": "Failed to fetch manga list"}), 500
    finally:
        db.close()


@bp.route("/api/manga/<int:manga_id>")
def get_manga_detail(manga_id):
    db = SessionLocal()
    try:
        manga = db.query(Manga).filter(Manga.id == manga_id).first()
        if not manga:
            return jsonify({"error": "Manga not found"}), 404

        return jsonify({
            "id": manga.id,
            "title": manga.title,
            "cover": manga.cover,
            "genres": manga.genres,
            "score": manga.score,
            "description": manga.description,
            "type": manga.type,
            "status": manga.status,
        })
    except Exception as e:
        print(f"[Error] /api/manga/{manga_id}: {e}")
        return jsonify({"error": "Failed to fetch manga details"}), 500
    finally:
        db.close()


@bp.route("/api/manga/<int:manga_id>/chapters")
@require_api_key
def get_manga_chapters(manga_id):
    db = SessionLocal()
    try:
        manga = db.query(Manga).filter(Manga.id == manga_id).first()
        if not manga:
            return jsonify({"error": "Manga not found"}), 404

        cached_chapters = (
            db.query(Chapter)
            .filter(Chapter.manga_id == manga_id)
            .order_by(func.nullif(func.regexp_replace(Chapter.chapter_number, '[^0-9.]', '', 'g'), '').cast(Float).nullsfirst())
            .all()
        )

        if cached_chapters:
            print(f"[Cache HIT] Chapters for manga {manga_id}")

            if _is_stale(manga):
                print(f"[Resync] Triggering background sync: {manga.title}")
                thread = threading.Thread(
                    target=_background_resync,
                    args=(manga_id, manga.title, getattr(manga, "alt_title", None)),
                    daemon=True
                )
                thread.start()

            return jsonify([{
                "id": c.id,
                "chapter_number": c.chapter_number,
                "title": c.title,
                "source": c.source,
            } for c in cached_chapters])

        print(f"[Cache MISS] First fetch for manga {manga_id}: {manga.title}")

        if not manga.available:
            db.query(Manga).filter(Manga.id == manga_id).update({"available": True})
            db.commit()

        fetch_and_merge_chapters(manga.title, manga_id, db, alt_title=getattr(manga, "alt_title", None))

        saved_chapters = (
            db.query(Chapter)
            .filter(Chapter.manga_id == manga_id)
            .order_by(func.nullif(func.regexp_replace(Chapter.chapter_number, '[^0-9.]', '', 'g'), '').cast(Float).nullsfirst())
            .all()
        )

        if not saved_chapters:
            db.query(Manga).filter(Manga.id == manga_id).update({"available": False})
            db.commit()
            print(f"[Availability] Marked unavailable: {manga.title}")
            return jsonify({"error": "No chapters found on any source"}), 404

        thread = threading.Thread(
            target=_fetch_and_cache_pages,
            args=(manga_id, saved_chapters[0].id),
            daemon=True
        )
        thread.start()

        return jsonify([{
            "id": c.id,
            "chapter_number": c.chapter_number,
            "title": c.title,
            "source": c.source,
        } for c in saved_chapters])

    except Exception as e:
        print(f"[Error] /api/manga/{manga_id}/chapters: {e}")
        return jsonify({"error": "Unexpected error fetching chapters"}), 500
    finally:
        db.close()


@bp.route("/api/chapters/<int:chapter_id>/pages")
@require_api_key
def get_chapter_pages(chapter_id):
    db = SessionLocal()
    try:
        manga_id = request.args.get("manga_id", type=int)

        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            return jsonify({"error": "Chapter not found"}), 404

        cached_pages = (
            db.query(Page)
            .filter(Page.chapter_id == chapter.id)
            .order_by(Page.page_number)
            .all()
        )

        if cached_pages:
            print(f"[Cache HIT] Pages for chapter {chapter_id}")
            if chapter.source == "mangadex":
                print(f"[MangaDex] Fetching fresh URLs for chapter {chapter_id}")
                fresh_pages, _ = _fetch_pages_for_chapter(chapter)
                if fresh_pages:
                    if manga_id:
                        prefetch_next_chapters(manga_id, chapter_id)
                    return jsonify(fresh_pages)
                print(f"[MangaDex] Fresh fetch failed, falling back to cache")
            if manga_id:
                prefetch_next_chapters(manga_id, chapter_id)
            return jsonify([{
                "page_number": p.page_number,
                "image_url": p.image_url
            } for p in cached_pages])

        print(f"[Cache MISS] Fetching pages for chapter {chapter_id} (source: {chapter.source})")
        pages_data, _ = _fetch_pages_for_chapter(chapter)

        if not pages_data:
            return jsonify({"error": "No pages found on any source"}), 404

        for p in pages_data:
            existing = db.query(Page).filter(
                Page.chapter_id == chapter.id,
                Page.page_number == p["page_number"]
            ).first()
            if not existing:
                db.add(Page(
                    chapter_id=chapter.id,
                    page_number=p["page_number"],
                    image_url=p["image_url"]
                ))
        db.commit()

        if manga_id:
            prefetch_next_chapters(manga_id, chapter_id)

        return jsonify(pages_data)

    except Exception as e:
        print(f"[Error] /api/chapters/{chapter_id}/pages: {e}")
        return jsonify({"error": "Unexpected error fetching pages"}), 500
    finally:
        db.close()


@bp.route("/api/search")
@require_api_key
def search():
    db = SessionLocal()
    try:
        query = request.args.get("q", "").strip()[:100]
        if not query:
            return jsonify([])

        existing = db.query(Manga).filter(
            (Manga.title.ilike(f"%{query}%")) |
            (Manga.alt_title.ilike(f"%{query}%"))
        ).all()
        if existing:
            return jsonify([{
                "id": m.id,
                "title": m.title,
                "cover": m.cover,
                "genres": m.genres,
                "score": m.score
            } for m in existing])

        print(f"[Search] Querying MAL + MangaDex for: {query}")
        mal_results = []
        md_results  = []

        def fetch_mal():
            try:
                return mal_search(query, limit=5)
            except Exception as e:
                print(f"[Search] MAL error: {e}")
                return []

        def fetch_md():
            try:
                return md_search(query)
            except Exception as e:
                print(f"[Search] MangaDex error: {e}")
                return []

        with ThreadPoolExecutor(max_workers=2) as executor:
            mal_future = executor.submit(fetch_mal)
            md_future  = executor.submit(fetch_md)
            try:
                mal_results = mal_future.result(timeout=10)
            except Exception:
                print("[Search] MAL timed out")
                mal_results = []
            try:
                md_results = md_future.result(timeout=10)
            except Exception:
                print("[Search] MangaDex timed out")
                md_results = []

        saved_titles = set()

        for data in mal_results:
            title     = data.get("title", "")
            alt_title = data.get("alt_title", "")
            s = _score_against_query(title, alt_title, query)
            if s >= 2:
                _save_manga_data(db, data, source="mal")
                saved_titles.add(normalize(title))
                print(f"[Search] MAL match (score {s}): {title}")
            else:
                print(f"[Search] MAL skipped (score {s}): {title}")

        for md_result in md_results[:5]:
            data  = _parse_mangadex_as_manga(md_result)
            if not data or not data.get("title") or not data.get("source_url"):
                continue
            title     = data.get("title", "")
            alt_title = data.get("alt_title", "")
            t_norm    = normalize(title)

            if t_norm in saved_titles:
                print(f"[Search] MangaDex skipped (already saved from MAL): {title}")
                continue

            s = _score_against_query(title, alt_title, query)
            if s >= 2:
                _save_manga_data(db, data, source="mangadex")
                saved_titles.add(t_norm)
                print(f"[Search] MangaDex match (score {s}): {title}")
            else:
                print(f"[Search] MangaDex skipped (score {s}): {title}")

        results = db.query(Manga).filter(
            (Manga.title.ilike(f"%{query}%")) |
            (Manga.alt_title.ilike(f"%{query}%"))
        ).all()
        return jsonify([{
            "id": m.id,
            "title": m.title,
            "cover": m.cover,
            "genres": m.genres,
            "score": m.score
        } for m in results])

    except Exception as e:
        print(f"[Error] /api/search: {e}")
        return jsonify({"error": "Search failed"}), 500
    finally:
        db.close()