# Yomuzuu

Manga / Manhwa / Manhua reading platform. Pulls metadata from the MAL API, aggregates chapters from multiple sources, and caches everything in PostgreSQL. Supports user accounts with cross-device bookmark and reading progress sync.

## Tech

| Layer | Stack |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, Flask, SQLAlchemy, APScheduler |
| Database | PostgreSQL (manga data), Supabase (auth + user data) |
| Auth | Supabase Auth — Google OAuth |
| Scraping | cloudscraper, BeautifulSoup, httpx |
| Deployment | Render (backend + frontend), Supabase (auth + user DB) |

## Features

- Browse and search manga sourced from MyAnimeList API
- Multi-source chapter aggregation — MangaFreak (primary), MangaDex, and Asura Scans
- Smart chapter merging with source priority and gap detection
- Cross-source page fallback — if one source fails, automatically retries others
- Auto re-sync for ONGOING manga every 24h via background thread
- Chapter reader with scroll and page mode — auto-detects based on manga type (manhwa/manhua defaults to scroll)
- Page prefetching and keyboard navigation
- **Auth-aware data layer** — guests use localStorage, authenticated users sync to Supabase with RLS
- **Bookmarks sync** — guest bookmarks auto-migrate to account on first login, no data loss
- **Read progress sync** — last chapter and page position per manga, synced across devices
- **Reader preferences sync** — scroll vs page mode saved per account
- **User profiles** — custom username and avatar (chosen from a built-in set) set on first login
- Background scheduler — syncs MAL data and refreshes stale chapters every 12h
- Rate limiting (Flask-Limiter + Redis), image proxy with host whitelist
- Changelog modal

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
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── Footer.jsx
    │   │   ├── Skeletons.jsx
    │   │   └── modals/     # Modal, AvatarPicker, LoginModal, ProfileModal, ChangelogModal
    │   ├── context/        # AuthContext — session, profile, needsOnboarding
    │   ├── hooks/          # useBookmarks, useReadProgress, usePreferences
    │   ├── lib/            # supabaseClient.js
    │   ├── assets/
    │   │   └── avatars/    # 15 avatar PNGs
    │   └── api.js          # Axios instance + global error interceptor
    ├── package.json
    └── vite.config.js
```

## Auth Architecture

Authentication is handled entirely on the frontend via Supabase. Flask does not touch auth — it only serves manga/chapter data as before.

| State | Bookmarks | Read Progress | Preferences |
|---|---|---|---|
| Guest | localStorage | localStorage | localStorage |
| Logged in | Supabase (`bookmarks` table) | Supabase (`read_progress` table) | Supabase (`user_preferences` table) |

On first login, any existing localStorage bookmarks are automatically merged into the user's account. Row Level Security (RLS) is enforced at the database level — users can only access their own data.

## Source Priority

| Source | Role | Type |
|---|---|---|
| MAL API | Metadata only (title, cover, score, genres) | Official API |
| MangaFreak | Primary chapter source | Scraper |
| MangaDex | Gap filler for chapters MangaFreak lacks | Official API |
| Asura Scans | Overwrites both — best English manhwa coverage | Scraper |

## Local Setup

**Prerequisites:** Python 3.10+, Node 18+, PostgreSQL running locally, Supabase project

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
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

```bash
npm run dev
```

### Supabase Setup

Run the following in your Supabase SQL editor:

```sql
-- Profiles
create table profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar_id text not null,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can manage their own profile"
  on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bookmarks
create table bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  manga_id integer not null,
  manga_title text,
  manga_cover text,
  created_at timestamptz default now(),
  unique(user_id, manga_id)
);
alter table bookmarks enable row level security;
create policy "Users can manage their own bookmarks"
  on bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Read Progress
create table read_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  chapter_id text not null,
  page integer default 0,
  total integer default 0,
  completed boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, chapter_id)
);
alter table read_progress enable row level security;
create policy "Users can manage their own progress"
  on read_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Preferences
create table user_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  reader_mode text default 'scroll' check (reader_mode in ('scroll', 'page')),
  updated_at timestamptz default now()
);
alter table user_preferences enable row level security;
create policy "Users can manage their own preferences"
  on user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Enable Google as an auth provider under **Authentication → Providers → Google** and add your OAuth credentials from Google Cloud Console.

## Deployment (Render + Supabase)

| Service | Config |
|---|---|
| Backend | Web Service, `gunicorn app:app`, Python 3 |
| Frontend | Static Site, `npm run build`, publish dir `dist` |
| Manga DB | Supabase PostgreSQL (Transaction pooler) |
| Auth + User DB | Supabase Auth + additional tables |

Set all `.env` values as environment variables in the Render dashboard. Set `VITE_API_URL` to your backend Render URL before building the frontend. Add your Render domain to Supabase **Authentication → URL Configuration → Redirect URLs**.

## Notes

- MAL client ID required — register at [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig)
- Scheduler runs on startup and every 12h — first run will populate the DB
- `API_KEY` gates chapter and search endpoints — leave blank to disable auth locally
- Asura Scans domain may change — update `BASE_URL` in `scrapers/asura.py` if chapters stop loading
- Supabase publishable (anon) key is safe to expose on the frontend — RLS enforces all data access

---
© 2026 chaszuu. All rights reserved.
Made with ♥ by [chaszuu](https://github.com/chaszuu)