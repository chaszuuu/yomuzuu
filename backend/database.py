import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set. Check your .env file or Render environment settings.")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # test connection before using it, reconnects if dead
    pool_recycle=300,          # recycle connections every 5 minutes
    pool_size=5,               # max persistent connections
    max_overflow=10,           # extra connections allowed under load
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

def init_db():
    from models import Manga, Chapter, Page
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()