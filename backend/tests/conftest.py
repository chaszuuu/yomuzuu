"""
conftest.py — shared fixtures for all tests.
"""

import os
import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

TEST_DATABASE_URL = os.environ.get("DATABASE_URL_test")
if not TEST_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL_test not set in .env. "
        "Add: DATABASE_URL_test=postgresql://postgres:password@localhost:5432/yomuzuu_test"
    )

print(f"\n[Test] Using DB: {TEST_DATABASE_URL}\n")


def _make_engine(url):
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=120,
        pool_size=3,
        max_overflow=7,
        pool_timeout=30,
        connect_args={
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 5,
            "keepalives_count": 3,
        }
    )


@pytest.fixture(scope="session")
def app():
    with patch.dict(os.environ, {"DATABASE_URL": TEST_DATABASE_URL}):
        from app import app as flask_app
        flask_app.config.update({
            "TESTING": True,
            "PROPAGATE_EXCEPTIONS": True,
        })
        flask_app.limiter.enabled = False
        yield flask_app


@pytest.fixture(scope="session")
def test_engine(app):
    engine = _make_engine(TEST_DATABASE_URL)
    with patch.dict(os.environ, {"DATABASE_URL": TEST_DATABASE_URL}):
        from database import Base
        import models  # noqa
        Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()
    with patch("routes.SessionLocal", return_value=session):
        yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def disable_api_key():
    with patch("routes.API_KEY", ""):
        yield


@pytest.fixture
def seed_manga(db_session):
    from models import Manga
    manga = Manga(
        title="Test Manga",
        alt_title="テストマンガ",
        cover="https://example.com/cover.jpg",
        description="A test manga description.",
        genres="Action,Fantasy",
        score="8.5",
        type="manga",
        source_url="https://myanimelist.net/manga/test-manga",
        available=True,
        status="ONGOING",
        last_synced_at=datetime.utcnow(),
    )
    db_session.add(manga)
    db_session.flush()
    return manga


@pytest.fixture
def seed_unavailable_manga(db_session):
    from models import Manga
    manga = Manga(
        title="Unavailable Manga",
        cover="https://example.com/cover2.jpg",
        description="This manga is unavailable.",
        genres="Horror",
        score="6.0",
        type="manhwa",
        source_url="https://myanimelist.net/manga/unavailable",
        available=False,
        status="ONGOING",
    )
    db_session.add(manga)
    db_session.flush()
    return manga


@pytest.fixture
def seed_chapter(db_session, seed_manga):
    from models import Chapter
    chapter = Chapter(
        manga_id=seed_manga.id,
        chapter_number="1",
        title="Chapter 1 - The Beginning",
        source_url="https://mangafreak.net/test-manga/chapter-1",
        source="mangafreak",
        cached_at=datetime.utcnow(),
    )
    db_session.add(chapter)
    db_session.flush()
    return chapter


@pytest.fixture
def seed_pages(db_session, seed_chapter):
    from models import Page
    pages = [
        Page(
            chapter_id=seed_chapter.id,
            page_number=i,
            image_url=f"https://example.com/page{i}.jpg"
        )
        for i in range(1, 4)
    ]
    for p in pages:
        db_session.add(p)
    db_session.flush()
    return pages