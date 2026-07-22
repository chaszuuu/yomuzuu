"""
Seeds the test database with enough manga to give /browse and the homepage
real scrollable height in CI (Playwright's window-level scroll simulation
needs actual overflow to produce a real 'scroll' event).

Idempotent — safe to run multiple times, only inserts titles that don't
already exist by title. TEST_MANGA_TITLE must stay 'One Piece' and stay
first in SEED_MANGA: the Playwright suite (tests/manga-e2e.spec.ts) searches
for and asserts against that exact title.

Usage: python scripts/seed_test_data.py
"""
from datetime import datetime

from database import init_db, SessionLocal
from models import Manga

SEED_MANGA = [
    dict(
        title="One Piece",
        cover="https://cdn.myanimelist.net/images/manga/2/253146.jpg",
        description="Gol D. Roger was known as the Pirate King.",
        genres="Action,Adventure,Fantasy",
        score="9.1",
        type="manga",
        source_url="https://myanimelist.net/manga/13",
    ),
    dict(
        title="Jujutsu Kaisen",
        cover="https://cdn.myanimelist.net/images/manga/3/210341.jpg",
        description="Cursed energy and sorcerers.",
        genres="Action,Horror,Supernatural",
        score="8.7",
        type="manga",
        source_url="https://myanimelist.net/manga/113138",
    ),
    dict(
        title="Solo Leveling",
        cover="https://cdn.myanimelist.net/images/manga/3/222295.jpg",
        description="The weakest hunter becomes the strongest.",
        genres="Action,Fantasy",
        score="8.5",
        type="manhwa",
        source_url="https://myanimelist.net/manga/107946",
    ),
    dict(
        title="Chainsaw Man",
        cover="https://cdn.myanimelist.net/images/manga/3/216464.jpg",
        description="Devils and chainsaws.",
        genres="Action,Horror",
        score="8.6",
        type="manga",
        source_url="https://myanimelist.net/manga/104307",
    ),
    dict(
        title="Omniscient Reader",
        cover="https://cdn.myanimelist.net/images/manga/3/222298.jpg",
        description="A reader becomes the protagonist.",
        genres="Action,Fantasy",
        score="8.6",
        type="manhwa",
        source_url="https://myanimelist.net/manga/126146",
    ),
    dict(
        title="Tower of God",
        cover="https://cdn.myanimelist.net/images/manga/1/209265.jpg",
        description="Climb the tower.",
        genres="Action,Fantasy,Mystery",
        score="8.3",
        type="manhwa",
        source_url="https://myanimelist.net/manga/72565",
    ),
    dict(
        title="Vinland Saga",
        cover="https://cdn.myanimelist.net/images/manga/2/188925.jpg",
        description="Vikings and revenge.",
        genres="Action,Adventure,Drama",
        score="8.8",
        type="manga",
        source_url="https://myanimelist.net/manga/24383",
    ),
    dict(
        title="The Beginning After The End",
        cover="https://cdn.myanimelist.net/images/manga/3/222299.jpg",
        description="A king reincarnated.",
        genres="Action,Fantasy",
        score="8.4",
        type="manhua",
        source_url="https://myanimelist.net/manga/104518",
    ),
    dict(
        title="Berserk",
        cover="https://cdn.myanimelist.net/images/manga/1/157897.jpg",
        description="Guts and the Band of the Hawk.",
        genres="Action,Horror,Fantasy",
        score="9.4",
        type="manga",
        source_url="https://myanimelist.net/manga/2",
    ),
    dict(
        title="Nano Machine",
        cover="https://cdn.myanimelist.net/images/manga/3/222300.jpg",
        description="Nanotechnology meets martial arts.",
        genres="Action,Fantasy",
        score="8.2",
        type="manhwa",
        source_url="https://myanimelist.net/manga/128163",
    ),
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        inserted = 0
        for data in SEED_MANGA:
            exists = db.query(Manga).filter(Manga.title == data["title"]).first()
            if exists:
                continue
            db.add(Manga(
                **data,
                available=True,
                status="ONGOING",
                last_synced_at=datetime.utcnow(),
            ))
            inserted += 1
            print(f"Seeded: {data['title']}")
        db.commit()
        print(f"Done — {inserted} inserted, {len(SEED_MANGA) - inserted} already present.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()