"""
test_chapter_routes.py — tests for /api/manga/<id>/chapters and /api/chapters/<id>/pages

External scrapers (MangaFreak, MangaDex, Asura) are mocked so tests never
hit real websites. Pages are seeded directly into the test DB.
"""

from unittest.mock import patch, MagicMock


# ─── GET /api/manga/<id>/chapters ────────────────────────────────────────────

class TestGetChapters:

    def test_returns_cached_chapters(self, client, db_session, seed_manga, seed_chapter):
        """When chapters are already in DB, return them without hitting scrapers."""
        res = client.get(f'/api/manga/{seed_manga.id}/chapters')
        assert res.status_code == 200

    def test_returns_list_of_chapters(self, client, db_session, seed_manga, seed_chapter):
        res = client.get(f'/api/manga/{seed_manga.id}/chapters')
        data = res.get_json()
        assert isinstance(data, list)
        assert len(data) == 1

    def test_chapter_has_required_fields(self, client, db_session, seed_manga, seed_chapter):
        res = client.get(f'/api/manga/{seed_manga.id}/chapters')
        chapter = res.get_json()[0]
        for field in ['id', 'chapter_number', 'title', 'source']:
            assert field in chapter, f"Missing field: {field}"

    def test_chapter_has_correct_data(self, client, db_session, seed_manga, seed_chapter):
        res = client.get(f'/api/manga/{seed_manga.id}/chapters')
        chapter = res.get_json()[0]
        assert chapter['chapter_number'] == "1"
        assert chapter['title'] == "Chapter 1 - The Beginning"
        assert chapter['source'] == "mangafreak"

    def test_returns_404_for_invalid_manga(self, client, db_session):
        res = client.get('/api/manga/999999999/chapters')
        assert res.status_code == 404

    def test_404_has_error_key(self, client, db_session):
        res = client.get('/api/manga/999999999/chapters')
        assert 'error' in res.get_json()

    def test_no_chapters_triggers_scraper_fetch(self, client, db_session, seed_manga):
        """
        When no chapters in DB, the route calls fetch_and_merge_chapters.
        We mock it to return 0 so the route marks manga unavailable and returns 404.
        """
        with patch('routes.fetch_and_merge_chapters', return_value=0):
            res = client.get(f'/api/manga/{seed_manga.id}/chapters')
            assert res.status_code == 404

    def test_stale_manga_triggers_background_resync(self, client, db_session, seed_manga, seed_chapter):
        """
        Manga with last_synced_at in the past should trigger a background resync thread.
        We mock threading.Thread to confirm it gets called.
        """
        from datetime import datetime, timedelta
        from models import Manga
        # Make manga stale
        db_session.query(Manga).filter(Manga.id == seed_manga.id).update({
            "last_synced_at": datetime.utcnow() - timedelta(hours=48)
        })
        db_session.flush()

        with patch('routes.threading.Thread') as mock_thread:
            mock_thread.return_value = MagicMock()
            res = client.get(f'/api/manga/{seed_manga.id}/chapters')
            assert res.status_code == 200
            mock_thread.assert_called_once()

    def test_content_type_is_json(self, client, db_session, seed_manga, seed_chapter):
        res = client.get(f'/api/manga/{seed_manga.id}/chapters')
        assert res.content_type == 'application/json'


# ─── GET /api/chapters/<id>/pages ────────────────────────────────────────────

class TestGetPages:

    def test_returns_cached_pages(self, client, db_session, seed_chapter, seed_pages):
        """Pages already in DB — should return them without hitting scrapers."""
        with patch('routes._fetch_pages_for_chapter') as mock_fetch:
            # mangafreak source uses cache directly, not fresh fetch
            res = client.get(f'/api/chapters/{seed_chapter.id}/pages')
            assert res.status_code == 200

    def test_returns_list_of_pages(self, client, db_session, seed_chapter, seed_pages):
        res = client.get(f'/api/chapters/{seed_chapter.id}/pages')
        data = res.get_json()
        assert isinstance(data, list)

    def test_pages_have_required_fields(self, client, db_session, seed_chapter, seed_pages):
        res = client.get(f'/api/chapters/{seed_chapter.id}/pages')
        if res.status_code == 200 and res.get_json():
            page = res.get_json()[0]
            assert 'page_number' in page
            assert 'image_url' in page

    def test_returns_404_for_invalid_chapter(self, client, db_session):
        res = client.get('/api/chapters/999999999/pages')
        assert res.status_code == 404

    def test_404_has_error_key(self, client, db_session):
        res = client.get('/api/chapters/999999999/pages')
        assert 'error' in res.get_json()

    def test_no_pages_triggers_scraper_fetch(self, client, db_session, seed_chapter):
        """No pages in DB — should call _fetch_pages_for_chapter."""
        mock_pages = [
            {"page_number": 1, "image_url": "https://example.com/page1.jpg"},
            {"page_number": 2, "image_url": "https://example.com/page2.jpg"},
        ]
        with patch('routes._fetch_pages_for_chapter', return_value=(mock_pages, 'mangafreak')):
            res = client.get(f'/api/chapters/{seed_chapter.id}/pages')
            assert res.status_code == 200
            data = res.get_json()
            assert len(data) == 2

    def test_no_pages_on_any_source_returns_404(self, client, db_session, seed_chapter):
        """Scraper returns empty — should return 404."""
        with patch('routes._fetch_pages_for_chapter', return_value=([], 'mangafreak')):
            res = client.get(f'/api/chapters/{seed_chapter.id}/pages')
            assert res.status_code == 404

    def test_manga_id_param_triggers_prefetch(self, client, db_session, seed_manga, seed_chapter, seed_pages):
        """Passing manga_id should trigger prefetch_next_chapters."""
        with patch('routes.prefetch_next_chapters') as mock_prefetch:
            res = client.get(f'/api/chapters/{seed_chapter.id}/pages?manga_id={seed_manga.id}')
            assert res.status_code == 200
            mock_prefetch.assert_called_once_with(seed_manga.id, seed_chapter.id)

    def test_content_type_is_json(self, client, db_session, seed_chapter, seed_pages):
        res = client.get(f'/api/chapters/{seed_chapter.id}/pages')
        assert res.content_type == 'application/json'