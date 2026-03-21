"""
Migration: Add source to chapters, status + last_synced_at to manga

Run once from your project root:
    python migrate.py

Safe to run multiple times — uses IF NOT EXISTS / DO NOTHING patterns.
"""
from dotenv import load_dotenv
load_dotenv()
from database import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        print("Running migration...")

        # chapters.source
        conn.execute(text("""
            ALTER TABLE chapters
            ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'mangadex';
        """))
        print("  + chapters.source")

        # manga.status
        conn.execute(text("""
            ALTER TABLE manga
            ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'ONGOING';
        """))
        print("  + manga.status")

        # manga.last_synced_at
        conn.execute(text("""
            ALTER TABLE manga
            ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
        """))
        print("  + manga.last_synced_at")

        # Backfill source on existing chapters based on source_url
        conn.execute(text("""
            UPDATE chapters
            SET source = CASE
                WHEN source_url LIKE '%mangadex.org%' THEN 'mangadex'
                ELSE 'mangafreak'
            END
            WHERE source IS NULL OR source = 'mangadex';
        """))
        print("  Backfilled chapters.source from existing source_urls")

        conn.commit()
        print("Migration complete!")

if __name__ == "__main__":
    run()