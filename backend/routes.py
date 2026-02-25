import os
import re
import threading
from functools import wraps
from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Manga, Chapter, Page
from services.mal import search_manga as mal_search
from scrapers.mangafreak import search_manga, get_chapters, get_pages

bp = Blueprint("routes", __name__)

# ─── Auth ────────────────────────────────────────────────────────────────────

API_KEY = os.environ.get("API_KEY", "")

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if API_KEY:
            key = request.headers.get("X-API-Key") or request.args.get("api_key")
            if key != API_KEY:
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


# ─── Helpers ────────────────────────────────────────────────────────────────

def clean_title(title):
    cleaned = re.sub(r"\s*\(.*?\)", "", title).strip()
    cleaned = re.sub(r"\s*:.*$", "", cleaned).strip()
    return cleaned


def normalize(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def best_match(results, title):
    target = normalize(clean_title(title))

    def score(result):
        r_raw = result["title"].lower()
        r = normalize(result["title"])
        t = target
        if r == t:
            return 4
        if r_raw == clean_title(title).lower():
            return 3
        if r.startswith(t) or t.startswith(r):
            return 2
        if t in r or r in t:
            return 1
        return 0

    scored = sorted(results, key=score, reverse=True)
    best = scored[0]
    best_score = score(best)

    if best_score < 2:
        print(f"[Search] No good match found (best was '{best['title']}')")
        return None

    print(f"[Search] Best match: '{best['title']}'")
    return best


def search_mangafreak_with_fallback(title):
    attempts = []
    attempts.append(title)
    attempts.append(clean_title(title))
    words = clean_title(title).split()
    if len(words) > 2:
        attempts.append(" ".join(words[:3]))
    if len(words) > 1:
        attempts.append(words[0])

    seen = set()
    attempts = [a for a in attempts if a and not (a in seen or seen.add(a))]

    for attempt in attempts:
        print(f"[Search] Trying MangaFreak with: '{attempt}'")
        try:
            results = search_manga(attempt)
            if results:
                print(f"[Search] Found {len(results)} results for '{attempt}'")
                match = best_match(results, title)
                if match:
                    return [match]
        except Exception as e:
            print(f"[Search] MangaFreak error for '{attempt}': {e}")

    print(f"[Search] No results found for any title variation of: '{title}'")
    return []


def _fetch_and_cache_pages(manga_id, chapter_source_url):
    db = SessionLocal()
    try:
        chapter = db.query(Chapter).filter(Chapter.source_url == chapter_source_url).first()
        if not chapter:
            return

        if db.query(Page).filter(Page.chapter_id == chapter.id).count() > 0:
            return

        print(f"[Prefetch] Fetching pages: {chapter_source_url}")
        pages_data = get_pages(chapter_source_url)
        if not pages_data:
            print(f"[Prefetch] No pages returned for {chapter_source_url}")
            return

        for p in pages_data:
            db.add(Page(
                chapter_id=chapter.id,
                page_number=p["page_number"],
                image_url=p["image_url"]
            ))
        db.commit()
        print(f"[Prefetch] Cached {len(pages_data)} pages")
    except Exception as e:
        print(f"[Prefetch] Failed for {chapter_source_url}: {e}")
    finally:
        db.close()


PREFETCH_AHEAD = 3

def prefetch_next_chapters(manga_id, current_chapter_id):
    try:
        db = SessionLocal()
        chapters = (
            db.query(Chapter)
            .filter(Chapter.manga_id == manga_id)
            .order_by(Chapter.id)
            .all()
        )
        db.close()

        ids = [c.id for c in chapters]
        if current_chapter_id not in ids:
            return

        idx = ids.index(current_chapter_id)
        upcoming = [c for c in chapters[idx + 1 : idx + 1 + PREFETCH_AHEAD]]

        for chapter in upcoming:
            thread = threading.Thread(
                target=_fetch_and_cache_pages,
                args=(manga_id, chapter.source_url),
                daemon=True
            )
            thread.start()

        if upcoming:
            print(f"[Prefetch] Queued {len(upcoming)} chapters ahead")
    except Exception as e:
        print(f"[Prefetch] Error finding next chapters: {e}")


# ─── Routes ─────────────────────────────────────────────────────────────────

@bp.route("/api/manga")
def get_manga():
    db = SessionLocal()
    try:
        manga_list = db.query(Manga).all()
        return jsonify([{
            "id": m.id,
            "title": m.title,
            "cover": m.cover,
            "genres": m.genres,
            "score": m.score,
            "type": m.type,
            "description": m.description,  
        } for m in manga_list if m.available])
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
            "type": manga.type
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
            .order_by(Chapter.id)
            .all()
        )
        if cached_chapters:
            print(f"[Cache HIT] Chapters for manga {manga_id}")
            return jsonify([{
                "id": c.id,
                "chapter_number": c.chapter_number,
                "title": c.title,
            } for c in cached_chapters])

        print(f"[Cache MISS] Scraping chapters for manga {manga_id}: {manga.title}")
        results = search_mangafreak_with_fallback(manga.title)

        if not results:
            try:
                db.query(Manga).filter(Manga.id == manga_id).update({"available": False})
                db.commit()
                print(f"[Availability] Marked manga {manga_id} as unavailable: {manga.title}")
            except Exception as mark_err:
                print(f"[Availability] Could not mark unavailable: {mark_err}")
            return jsonify({"error": "Not found on MangaFreak"}), 404

        try:
            chapters_data = get_chapters(results[0]["url"])
        except Exception as e:
            print(f"[Error] get_chapters failed: {e}")
            return jsonify({"error": "Failed to fetch chapters from MangaFreak"}), 502

        if not chapters_data:
            return jsonify({"error": "No chapters found"}), 404

        for c in chapters_data:
            existing = db.query(Chapter).filter(Chapter.source_url == c["source_url"]).first()
            if not existing:
                db.add(Chapter(
                    manga_id=manga_id,
                    chapter_number=c["chapter_number"],
                    title=c["title"],
                    source_url=c["source_url"]
                ))
        db.commit()

        first_chapter = db.query(Chapter).filter(
            Chapter.manga_id == manga_id
        ).order_by(Chapter.id).first()

        if first_chapter:
            thread = threading.Thread(
                target=_fetch_and_cache_pages,
                args=(manga_id, first_chapter.source_url),
                daemon=True
            )
            thread.start()

        saved_chapters = (
            db.query(Chapter)
            .filter(Chapter.manga_id == manga_id)
            .order_by(Chapter.id)
            .all()
        )
        return jsonify([{
            "id": c.id,
            "chapter_number": c.chapter_number,
            "title": c.title,
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
            if manga_id:
                prefetch_next_chapters(manga_id, chapter_id)
            return jsonify([{
                "page_number": p.page_number,
                "image_url": p.image_url
            } for p in cached_pages])

        print(f"[Cache MISS] Scraping pages for chapter {chapter_id}")
        try:
            pages_data = get_pages(chapter.source_url)
        except Exception as e:
            print(f"[Error] get_pages failed: {e}")
            return jsonify({"error": "Failed to fetch pages from MangaFreak"}), 502

        if not pages_data:
            return jsonify({"error": "No pages found for this chapter"}), 404

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

        # Check DB first
        existing = db.query(Manga).filter(Manga.title.ilike(f"%{query}%")).all()
        if existing:
            return jsonify([{
                "id": m.id,
                "title": m.title,
                "cover": m.cover,
                "genres": m.genres,
                "score": m.score
            } for m in existing])

        # Not in DB — search MAL API
        print(f"[Search] Querying MAL API for: {query}")
        mal_results = mal_search(query, limit=5)

        if not mal_results:
            return jsonify([])

        for data in mal_results:
            try:
                if not data.get("title"):
                    continue
                already = db.query(Manga).filter(Manga.source_url == data["source_url"]).first()
                if not already:
                    db.add(Manga(
                        title=data["title"],
                        cover=data["cover"],
                        description=data["description"],
                        genres=data["genres"],
                        score=data["score"],
                        type=data["type"],
                        source_url=data["source_url"]
                    ))
                    db.commit()
            except Exception as e:
                print(f"[Search] Failed saving {data.get('title')}: {e}")

        results = db.query(Manga).filter(Manga.title.ilike(f"%{query}%")).all()
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