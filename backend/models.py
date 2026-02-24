from database import Base
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime


class Manga(Base):
    __tablename__ = "manga"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    cover = Column(String)
    description = Column(Text)
    genres = Column(String)
    type = Column(String)
    source_url = Column(String, unique=True)
    score = Column(String)
    available = Column(Boolean, default=True, nullable=False)
    chapters = relationship("Chapter", back_populates="manga")

    __table_args__ = (
        Index("idx_manga_available", "available"),
        Index("idx_manga_title", "title"),
    )


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True)
    manga_id = Column(Integer, ForeignKey("manga.id"))
    chapter_number = Column(String)
    title = Column(String)
    source_url = Column(String, unique=True)
    cached_at = Column(DateTime, default=datetime.utcnow)  # When chapters were last scraped

    manga = relationship("Manga", back_populates="chapters")
    pages = relationship("Page", back_populates="chapter")

    __table_args__ = (
        Index("idx_chapters_manga_id", "manga_id"),
    )


class Page(Base):
    __tablename__ = "pages"

    id = Column(Integer, primary_key=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))
    page_number = Column(Integer)
    image_url = Column(String)

    chapter = relationship(Chapter, back_populates="pages")

    __table_args__ = (
        Index("idx_pages_chapter_id", "chapter_id"),
    )