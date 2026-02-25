import os
import httpx

MAL_CLIENT_ID = os.environ.get("MAL_CLIENT_ID", "")

HEADERS = {
    "X-MAL-CLIENT-ID": MAL_CLIENT_ID
}

BASE_URL = "https://api.myanimelist.net/v2"

# Fields to request from MAL API
MANGA_FIELDS = "title,main_picture,synopsis,genres,mean,media_type,num_chapters,status"


def get_top_manga(limit=50, offset=0):
    """
    Fetch top manga from MAL API.
    Replaces get_manga_links() + scrape_manga() combo from the old scraper.
    Returns a list of manga dicts ready to save to DB.
    """
    try:
        response = httpx.get(
            f"{BASE_URL}/manga/ranking",
            headers=HEADERS,
            params={
                "ranking_type": "manga",
                "limit": limit,
                "offset": offset,
                "fields": MANGA_FIELDS
            },
            timeout=15
        )
        response.raise_for_status()
        data = response.json()

        results = []
        for entry in data.get("data", []):
            node = entry.get("node", {})
            results.append(_parse_manga(node))

        return results

    except httpx.TimeoutException:
        print("[MAL API] Timeout fetching top manga")
        return []
    except Exception as e:
        print(f"[MAL API] Failed to fetch top manga: {e}")
        return []


def get_manga_by_id(mal_id):
    """
    Fetch a single manga by MAL ID.
    """
    try:
        response = httpx.get(
            f"{BASE_URL}/manga/{mal_id}",
            headers=HEADERS,
            params={"fields": MANGA_FIELDS},
            timeout=15
        )
        response.raise_for_status()
        node = response.json()
        return _parse_manga(node)

    except httpx.TimeoutException:
        print(f"[MAL API] Timeout fetching manga {mal_id}")
        return None
    except Exception as e:
        print(f"[MAL API] Failed to fetch manga {mal_id}: {e}")
        return None


def search_manga(query, limit=5):
    """
    Search MAL for manga by title.
    Replaces the search_mal() function in routes.py.
    Returns a list of manga dicts.
    """
    try:
        response = httpx.get(
            f"{BASE_URL}/manga",
            headers=HEADERS,
            params={
                "q": query,
                "limit": limit,
                "fields": MANGA_FIELDS
            },
            timeout=15
        )
        response.raise_for_status()
        data = response.json()

        results = []
        for entry in data.get("data", []):
            node = entry.get("node", {})
            results.append(_parse_manga(node))

        return results

    except httpx.TimeoutException:
        print(f"[MAL API] Timeout searching for: {query}")
        return []
    except Exception as e:
        print(f"[MAL API] Search failed for '{query}': {e}")
        return []


def _parse_manga(node):
    """
    Parse a MAL API manga node into the same dict shape
    the rest of the app expects — keeps routes.py and scheduler.py changes minimal.
    """
    mal_id = node.get("id")
    source_url = f"https://myanimelist.net/manga/{mal_id}" if mal_id else None

    # Cover image — prefer large, fallback to medium
    picture = node.get("main_picture", {})
    cover = picture.get("large") or picture.get("medium")

    # Genres — join into comma separated string to match existing DB format
    genres = node.get("genres", [])
    genres_str = ", ".join([g["name"] for g in genres]) if genres else None

    # Score — MAL API returns as float e.g. 9.1, store as string to match existing schema
    score = node.get("mean")
    score_str = str(score) if score else None

    return {
        "title": node.get("title"),
        "cover": cover,
        "description": node.get("synopsis"),
        "genres": genres_str,
        "score": score_str,
        "type": node.get("media_type"),
        "source_url": source_url,
        "mal_id": mal_id
    }