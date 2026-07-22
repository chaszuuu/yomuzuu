"""
test_search_routes.py — tests for /api/search

MAL and MangaDex are mocked so tests never hit real external APIs.
DB searches use seeded test data.
"""

from unittest.mock import patch


# ─── GET /api/search ─────────────────────────────────────────────────────────

class TestSearch:

    # ── Empty / missing query ────────────────────────────────────────────────

    def test_empty_query_returns_empty_list(self, client, db_session):
        res = client.get('/api/search?q=')
        assert res.status_code == 200
        assert res.get_json() == []

    def test_missing_query_param_returns_empty_list(self, client, db_session):
        res = client.get('/api/search')
        assert res.status_code == 200
        assert res.get_json() == []

    def test_whitespace_only_query_returns_empty_list(self, client, db_session):
        res = client.get('/api/search?q=   ')
        assert res.status_code == 200
        assert res.get_json() == []

    # ── DB hit (title already in DB) ─────────────────────────────────────────

    def test_finds_manga_already_in_db(self, client, db_session, seed_manga):
        """If title is in DB, should return it without hitting MAL/MangaDex."""
        with patch('routes.mal_search') as mock_mal, \
             patch('routes.md_search') as mock_md:
            res = client.get('/api/search?q=Test Manga')
            assert res.status_code == 200
            data = res.get_json()
            assert any(m['title'] == 'Test Manga' for m in data)
            # MAL and MangaDex should NOT be called since it's in DB
            mock_mal.assert_not_called()
            mock_md.assert_not_called()

    def test_db_search_is_case_insensitive(self, client, db_session, seed_manga):
        res = client.get('/api/search?q=test manga')
        assert res.status_code == 200
        data = res.get_json()
        assert any(m['title'] == 'Test Manga' for m in data)

    def test_db_search_finds_partial_title(self, client, db_session, seed_manga):
        res = client.get('/api/search?q=Test')
        assert res.status_code == 200
        data = res.get_json()
        assert any(m['title'] == 'Test Manga' for m in data)

    def test_db_search_finds_by_alt_title(self, client, db_session, seed_manga):
        """seed_manga has alt_title='テストマンガ' — search should find it."""
        res = client.get('/api/search?q=テストマンガ')
        assert res.status_code == 200
        data = res.get_json()
        assert any(m['title'] == 'Test Manga' for m in data)

    def test_result_has_required_fields(self, client, db_session, seed_manga):
        res = client.get('/api/search?q=Test Manga')
        result = res.get_json()[0]
        for field in ['id', 'title', 'cover', 'genres', 'score']:
            assert field in result, f"Missing field: {field}"

    def test_result_does_not_expose_source_url(self, client, db_session, seed_manga):
        res = client.get('/api/search?q=Test Manga')
        result = res.get_json()[0]
        assert 'source_url' not in result

    # ── External API fallback (title not in DB) ──────────────────────────────

    def test_calls_mal_when_not_in_db(self, client, db_session):
        """Title not in DB — should call MAL."""
        mal_result = [{
            "title": "One Piece",
            "alt_title": "ワンピース",
            "cover": "https://example.com/op.jpg",
            "description": "Pirates.",
            "genres": "Action,Adventure",
            "score": "9.0",
            "type": "manga",
            "source_url": "https://myanimelist.net/manga/13",
        }]
        with patch('routes.mal_search', return_value=mal_result) as mock_mal, \
             patch('routes.md_search', return_value=[]):
            res = client.get('/api/search?q=One Piece')
            assert res.status_code == 200
            mock_mal.assert_called_once_with("One Piece", limit=5)

    def test_saves_mal_result_to_db(self, client, db_session):
        """MAL result with good score match should be saved to DB."""
        mal_result = [{
            "title": "Naruto",
            "alt_title": "ナルト",
            "cover": "https://example.com/naruto.jpg",
            "description": "Ninja.",
            "genres": "Action,Shounen",
            "score": "8.0",
            "type": "manga",
            "source_url": "https://myanimelist.net/manga/11",
        }]
        with patch('routes.mal_search', return_value=mal_result), \
             patch('routes.md_search', return_value=[]):
            res = client.get('/api/search?q=Naruto')
            assert res.status_code == 200
            # Should now be findable in DB without MAL
            from models import Manga
            saved = db_session.query(Manga).filter(Manga.title == "Naruto").first()
            assert saved is not None

    def test_falls_back_to_mangadex_when_mal_empty(self, client, db_session):
        """When MAL returns nothing, should try MangaDex."""
        md_result = [{
            "title": "Solo Leveling",
            "cover": "https://example.com/sl.jpg",
            "description": "A hunter.",
            "genres": "Action,Fantasy",
            "score": "8.8",
            "type": "manhwa",
            "url": "https://mangadex.org/title/solo-leveling",
            "alt_title": None,
        }]
        with patch('routes.mal_search', return_value=[]), \
             patch('routes.md_search', return_value=md_result) as mock_md:
            res = client.get('/api/search?q=Solo Leveling')
            assert res.status_code == 200
            mock_md.assert_called_once()

    def test_nonexistent_title_returns_empty_list(self, client, db_session):
        """Neither DB nor MAL nor MangaDex has it — return []."""
        with patch('routes.mal_search', return_value=[]), \
             patch('routes.md_search', return_value=[]):
            res = client.get('/api/search?q=zzznonexistentmanga99999')
            assert res.status_code == 200
            assert res.get_json() == []

    def test_query_truncated_to_100_chars(self, client, db_session):
        """Route truncates query to 100 chars — should not error."""
        long_query = "a" * 200
        with patch('routes.mal_search', return_value=[]), \
             patch('routes.md_search', return_value=[]):
            res = client.get(f'/api/search?q={long_query}')
            assert res.status_code == 200

    def test_content_type_is_json(self, client, db_session):
        res = client.get('/api/search?q=test')
        assert res.content_type == 'application/json'

    # ── MAL/MangaDex failure handling ────────────────────────────────────────

    def test_mal_timeout_does_not_crash(self, client, db_session):
        """If MAL times out, route should still return 200 (possibly empty)."""
        with patch('routes.mal_search', side_effect=Exception("timeout")), \
             patch('routes.md_search', return_value=[]):
            res = client.get('/api/search?q=something')
            assert res.status_code == 200

    def test_mangadex_failure_does_not_crash(self, client, db_session):
        """If MangaDex fails, route should still return 200."""
        with patch('routes.mal_search', return_value=[]), \
             patch('routes.md_search', side_effect=Exception("connection error")):
            res = client.get('/api/search?q=something')
            assert res.status_code == 200