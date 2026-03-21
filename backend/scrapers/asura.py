import re
import json
import cloudscraper

BASE_URL = "https://asurascans.com"
API_URL = "https://api.asurascans.com/api"

# Shared client — maintains cookies across requests so access_token
# picked up from the site can be reused for API calls
client = cloudscraper.create_scraper()


def _get_auth_token():
    """
    Visit the base site to pick up the access_token cookie Asura sets.
    Returns the token string or None if not found.
    """
    try:
        client.get(BASE_URL, headers={"Referer": f"{BASE_URL}/"})
        for cookie in client.cookies:
            if cookie.name == "access_token":
                return cookie.value
    except Exception as e:
        print(f"[Asura] Failed to get auth token: {e}")
    return None


def _api_headers():
    """Build headers with Bearer token if available."""
    token = _get_auth_token()
    headers = {"Referer": f"{BASE_URL}/"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def search_manga(query):
    try:
        r = client.get(
            f"{API_URL}/series",
            params={"search": query, "limit": 20, "offset": 0},
            headers=_api_headers(),
        )
        r.raise_for_status()
        data = r.json()

        results = []
        for item in data.get("data") or []:
            slug = item.get("slug", "")
            title = item.get("title", "")
            if not slug or not title:
                continue
            results.append({
                "title": title,
                "url": f"{BASE_URL}/comics/{slug}",
                "slug": slug,
                "thumbnail": item.get("cover", ""),
            })
        return results

    except Exception as e:
        print(f"[Asura] search_manga failed: {e}")
        return []


def get_chapters(manga_url):
    """
    Fetches chapter list via the Asura API with pagination.
    GET /api/series/{slug}/chapters?page=1&perPage=9999
    Skips locked (premium) chapters.
    """
    try:
        slug = manga_url.rstrip("/").split("/")[-1]
        headers = _api_headers()
        chapters = []
        page = 1

        while True:
            r = client.get(
                f"{API_URL}/series/{slug}/chapters",
                params={"page": page, "perPage": 100},
                headers=headers,
            )
            r.raise_for_status()
            data = r.json()

            # Response may be a list directly or wrapped in data key
            items = data if isinstance(data, list) else (data.get("data") or data.get("chapters") or [])

            if not items:
                break

            for ch in items:
                if not isinstance(ch, dict):
                    continue
                # Skip locked/premium chapters
                if ch.get("is_locked", False):
                    continue

                number = ch.get("number", 0)
                try:
                    number_float = float(number)
                    number_str = str(int(number_float)) if number_float == int(number_float) else str(number_float)
                except (ValueError, TypeError):
                    number_str = str(number)

                series_slug = ch.get("series_slug") or slug
                chapters.append({
                    "chapter_number": number_str,
                    "title": f"Chapter {number_str}" + (f" - {ch['title']}" if ch.get("title") else ""),
                    "source_url": f"{BASE_URL}/series/{series_slug}/chapter/{number_str}",
                    "date": ch.get("created_at", ""),
                })

            # Check if more pages
            meta = data.get("meta") if isinstance(data, dict) else None
            has_more = meta.get("has_more", False) if meta else False
            if not has_more or len(items) < 100:
                break
            page += 1

        chapters.sort(key=lambda x: float(x["chapter_number"]) if x["chapter_number"].replace(".", "").isdigit() else 0)
        return chapters

    except Exception as e:
        print(f"[Asura] get_chapters failed: {e}")
        return []




def get_pages(chapter_url):
    """
    Fetches pages via the API.
    chapter_url format: https://asurascans.com/series/{series_slug}/chapter/{number}
    API endpoint: GET /api/series/{series_slug}/chapters/{number}
    """
    try:
        # Extract series slug and chapter number from URL
        match = re.search(r"/series/([^/]+)/chapter/([^/]+)", chapter_url)
        if not match:
            print(f"[Asura] Could not parse chapter URL: {chapter_url}")
            return []

        series_slug = match.group(1)
        chapter_number = match.group(2)

        r = client.get(
            f"{API_URL}/series/{series_slug}/chapters/{chapter_number}",
            headers=_api_headers(),
        )
        r.raise_for_status()
        data = r.json()

        # Response: {"data": {"chapter": {"pages": [{"url": "..."}]}}}
        chapter_data = (data.get("data") or {}).get("chapter") or {}
        page_list = chapter_data.get("pages") or []

        return [
            {"page_number": i + 1, "image_url": p["url"]}
            for i, p in enumerate(page_list)
            if p.get("url")
        ]

    except Exception as e:
        print(f"[Asura] get_pages failed: {e}")
        return []
