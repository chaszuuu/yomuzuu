import os
import httpx

MAL_CLIENT_ID = os.environ.get("MAL_CLIENT_ID", "")

HEADERS = {
    "X-MAL-CLIENT-ID": MAL_CLIENT_ID
}

BASE_URL = "https://api.myanimelist.net/v2"

# Added alternative_titles to pull synonyms (romaji, en alt)
MANGA_FIELDS = "title,main_picture,synopsis,genres,mean,media_type,num_chapters,status,alternative_titles"


def get_top_manga(limit=50, offset=0):
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
    query = query[:64].rsplit(" ", 1)[0] if len(query) > 64 else query
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
    mal_id = node.get("id")
    source_url = f"https://myanimelist.net/manga/{mal_id}" if mal_id else None

    picture = node.get("main_picture", {})
    cover = picture.get("large") or picture.get("medium")

    genres = node.get("genres", [])
    genres_str = ", ".join([g["name"] for g in genres]) if genres else None

    score = node.get("mean")
    score_str = str(score) if score else None

    # Extract alt title — prefer synonyms first (romaji), then english alt
    alt_titles = node.get("alternative_titles", {})
    synonyms = alt_titles.get("synonyms", [])
    en_alt = alt_titles.get("en", "")

    # Pick the best alt title to store:
    # synonyms[0] is usually the romaji which is what sources use
    alt_title = None
    if synonyms:
        alt_title = synonyms[0]
    elif en_alt and en_alt != node.get("title"):
        alt_title = en_alt

    return {
        "title": node.get("title"),
        "cover": cover,
        "description": node.get("synopsis"),
        "genres": genres_str,
        "score": score_str,
        "type": node.get("media_type"),
        "source_url": source_url,
        "mal_id": mal_id,
        "alt_title": alt_title,
        "synonyms": synonyms,
    }