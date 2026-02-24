import time
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from models import Manga, Chapter
from scrapers.mal import get_manga_links, scrape_manga
from scrapers.mangafreak import search_manga, get_chapters

# How old chapter cache must be before refreshing
CHAPTER_STALE_DAYS = 1


def update_mal():
    print("Scheduler: Scraping MAL...")
    db = SessionLocal()
    try:
        links = get_manga_links(page=0)
        for url in links:
            try:
                data = scrape_manga(url)
                if not data["title"]:
                    continue

                existing = db.query(Manga).filter(Manga.source_url == url).first()
                if existing:
                    existing.title = data["title"]
                    existing.score = data["score"]
                    existing.description = data["description"]
                    existing.genres = data["genres"]
                    existing.cover = data["cover"]
                    print(f"[Scheduler] Updated: {data['title']}")
                else:
                    db.add(Manga(
                        title=data["title"],
                        cover=data["cover"],
                        description=data["description"],
                        genres=data["genres"],
                        score=data["score"],
                        source_url=data["source_url"]
                    ))
                    print(f"[Scheduler] Added: {data['title']}")

                db.commit()
                time.sleep(2)
            except Exception as e:
                print(f"[Scheduler] MAL failed for {url}: {e}")
    finally:
        db.close()
    print("Scheduler: MAL update done!")


def refresh_stale_chapters():
    """Re-scrape chapters for manga whose cache is older than CHAPTER_STALE_DAYS."""
    print("Scheduler: Checking for stale chapters...")
    db = SessionLocal()
    try:
        stale_cutoff = datetime.utcnow() - timedelta(days=CHAPTER_STALE_DAYS)

        # Find available manga that have stale or missing chapter caches
        manga_list = db.query(Manga).filter(Manga.available == True).all()
        refreshed = 0

        for manga in manga_list:
            try:
                # Get the most recently cached chapter for this manga
                latest_chapter = (
                    db.query(Chapter)
                    .filter(Chapter.manga_id == manga.id)
                    .order_by(Chapter.cached_at.desc())
                    .first()
                )

                # Skip if cache is still fresh
                if latest_chapter and latest_chapter.cached_at and latest_chapter.cached_at > stale_cutoff:
                    continue

                print(f"[Scheduler] Refreshing chapters for: {manga.title}")
                from routes import search_mangafreak_with_fallback
                results = search_mangafreak_with_fallback(manga.title)

                if not results:
                    print(f"[Scheduler] Still not found on MangaFreak: {manga.title}")
                    continue

                fresh_chapters = get_chapters(results[0]["url"])
                if not fresh_chapters:
                    continue

                # Find and add any new chapters not already in DB
                existing_urls = {
                    c.source_url for c in db.query(Chapter)
                    .filter(Chapter.manga_id == manga.id).all()
                }

                new_count = 0
                for c in fresh_chapters:
                    if c["source_url"] not in existing_urls:
                        db.add(Chapter(
                            manga_id=manga.id,
                            chapter_number=c["chapter_number"],
                            title=c["title"],
                            source_url=c["source_url"],
                            cached_at=datetime.utcnow()
                        ))
                        new_count += 1

                # Update cached_at on all existing chapters for this manga
                db.query(Chapter).filter(Chapter.manga_id == manga.id).update(
                    {"cached_at": datetime.utcnow()}
                )

                db.commit()
                refreshed += 1

                if new_count > 0:
                    print(f"[Scheduler] {manga.title}: +{new_count} new chapters")
                else:
                    print(f"[Scheduler] {manga.title}: up to date")

                time.sleep(1)

            except Exception as e:
                print(f"[Scheduler] Failed refreshing {manga.title}: {e}")

        print(f"Scheduler: Chapter refresh done! ({refreshed} manga checked)")
    finally:
        db.close()


def run_all():
    update_mal()
    refresh_stale_chapters()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_all, "interval", hours=12)  # Every 12 hours
    scheduler.start()
    print("Scheduler started — updates every 12 hours")
    return scheduler