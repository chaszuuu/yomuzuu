# Yomuzuu

Manga / Manhwa / Manhua reading platform. Pulls metadata from the MAL API, aggregates chapters from multiple sources, and caches everything in PostgreSQL.

## Tech

| Layer | Stack |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, Flask, SQLAlchemy, APScheduler |
| Database | PostgreSQL |
| Scraping | cloudscraper, BeautifulSoup, httpx |
| Deployment | Render (backend + DB), Render Static (frontend) |

## Features

- Browse and search manga sourced from MyAnimeList API
- Multi-source chapter aggregation — MangaDex (primary), MangaFreak, and Asura Scans
- Smart chapter merging with source priority and gap detection
- Cross-source page fallback — if one source fails, automatically retries others
- Auto re-sync for ONGOING manga every 24h via background thread
- Chapter reader with scroll and page mode — auto-detects based on manga type (manhwa/manhua defaults to scroll)
- Page prefetching and keyboard navigation
- Bookmarks and read progress (localStorage)
- Background scheduler — syncs MAL data and refreshes stale chapters every 12h
- Rate limiting (Flask-Limiter + Redis), image proxy with host whitelist

## Project Structure

```
yomuzuu/
├── backend/
│   ├── app.py              # Flask app, CORS, rate limiter, startup
│   ├── routes.py           # API endpoints + chapter merge logic
│   ├── models.py           # SQLAlchemy models (Manga, Chapter, Page)
│   ├── database.py         # Engine + session factory
│   ├── scheduler.py        # MAL sync + chapter refresh jobs
│   ├── proxy.py            # Image proxy blueprint
│   ├── requirements.txt
│   ├── services/
│   │   ├── mal.py          # MAL API client (metadata)
│   │   └── mangadex.py     # MangaDex API client (chapters + pages)
│   └── scrapers/
│       ├── mangafreak.py   # MangaFreak scraper (chapters + pages)
│       └── asura.py        # Asura Scans scraper (chapters + pages)
└── frontend/
    ├── src/
    │   ├── pages/          # Home, Browse, MangaDetail, Chapter, Bookmarks
    │   ├── components/     # Navbar, Footer, Skeletons
    │   ├── hooks/          # useBookmarks
    │   └── api.js          # Axios instance + global error interceptor
    ├── package.json
    └── vite.config.js
```

## Source Priority

| Source | Role | Type |
|---|---|---|
| MAL API | Metadata only (title, cover, score, genres) | Official API |
| MangaDex | Primary chapter source | Official API |
| MangaFreak | Gap filler for chapters MangaDex lacks | Scraper |
| Asura Scans | Overwrites both — best English manhwa coverage | Scraper |

## Local Setup

**Prerequisites:** Python 3.10+, Node 18+, PostgreSQL running locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost/yomuzuu
MAL_CLIENT_ID=your_mal_client_id
API_KEY=your_secret_api_key
FRONTEND_URL=http://localhost:5173
```

```bash
python app.py
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_API_KEY=your_secret_api_key
```

```bash
npm run dev
```

## Deployment (Render)

| Service | Config |
|---|---|
| Backend | Web Service, `gunicorn app:app`, Python 3 |
| Frontend | Static Site, `npm run build`, publish dir `dist` |
| Database | Render PostgreSQL |

Set all `.env` values as environment variables in the Render dashboard. Set `VITE_API_URL` to your backend Render URL before building the frontend.

## Notes

- MAL client ID required — register at [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig)
- Scheduler runs on startup and every 12h — first run will populate the DB
- `API_KEY` gates chapter and search endpoints — leave blank to disable auth locally
- Asura Scans domain may change — update `BASE_URL` in `scrapers/asura.py` if chapters stop loading

---

Made with ♥ by [chaszuu](https://github.com/chaszuu)