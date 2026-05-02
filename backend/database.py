import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set. Check your .env file or Render environment settings.")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=120,          # recycle every 2 min instead of 5
    pool_size=3,               # fewer persistent connections
    max_overflow=7,
    pool_timeout=30,           # wait max 30s for a connection before erroring
    connect_args={
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 5,
        "keepalives_count": 3,
    }
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