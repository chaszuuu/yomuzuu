# Yomuzuu 📖

A manga reading platform that aggregates titles from MyAnimeList and serves chapters via MangaFreak.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Python + Flask + SQLAlchemy
- **Database:** SQLite
- **Scraping:** cloudscraper + BeautifulSoup

## Features

- Browse and search manga titles sourced from MAL
- Read chapters via integrated reader
- Bookmark manga (localStorage)
- Resume reading from where you left off
- Search with live dropdown

## Project Structure

```
yomuzuu/
├── backend/
│   ├── app.py              # Flask app + API routes
│   ├── models.py           # SQLAlchemy models
│   ├── requirements.txt
│   └── scrapers/           # MAL + MangaFreak scrapers
├── frontend/
│   ├── src/
│   │   ├── pages/          # Home, MangaDetail, Reader, Bookmarks
│   │   └── components/     # Navbar
│   ├── package.json
│   └── vite.config.js
```

## Local Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create a `.env` file in `frontend/`:

```
VITE_API_URL=http://localhost:5000
```

## Deployment

Deployed on [Render](https://render.com):

- **Backend:** Web Service (Python), start command `gunicorn app:app`
- **Frontend:** Static Site, build command `npm install && npm run build`, publish dir `dist`

Set `VITE_API_URL` in the frontend environment variables to your backend Render URL.

## Credits

Made with ♥ by chaszuu
