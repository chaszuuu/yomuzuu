import httpx

BASE_URL = "https://api.mangadex.org"

client = httpx.Client(timeout=15)


def search_manga(query):
    try:
        r = client.get(f"{BASE_URL}/manga", params={
            "title": query,
            "limit": 10,
            "availableTranslatedLanguage[]": "en",
            "contentRating[]": ["safe", "suggestive", "erotica"],
        })
        r.raise_for_status()
        data = r.json()

        results = []
        for item in data.get("data", []):
            attrs = item.get("attributes", {})

            # Prefer English title
            title = attrs.get("title", {}).get("en")

            # Many manhwa/manhua store native title as main — check altTitles for English
            if not title:
                for alt in attrs.get("altTitles", []):
                    if "en" in alt:
                        title = alt["en"]
                        break

            # Last resort: first available title in any language
            if not title:
                title = next(iter(attrs.get("title", {}).values()), "")

            results.append({
                "title": title,
                "url": f"{BASE_URL}/manga/{item['id']}",
            })
        return results

    except Exception as e:
        print(f"[MangaDex] search_manga failed: {e}")
        return []


def get_chapters(manga_url):
    try:
        manga_id = manga_url.split("/manga/")[-1].split("/")[0]

        chapters = []
        offset = 0
        limit = 100

        while True:
            r = client.get(f"{BASE_URL}/manga/{manga_id}/feed", params={
                "translatedLanguage[]": "en",
                "limit": limit,
                "offset": offset,
                "order[chapter]": "asc",
                "contentRating[]": ["safe", "suggestive", "erotica"],
            })
            r.raise_for_status()
            data = r.json()
            items = data.get("data", [])

            if not items:
                break

            for item in items:
                attrs = item.get("attributes", {})
                chapter_number = attrs.get("chapter") or "0"
                title = attrs.get("title") or f"Chapter {chapter_number}"
                chapters.append({
                    "chapter_number": chapter_number,
                    "title": title,
                    "source_url": f"{BASE_URL}/chapter/{item['id']}",
                    "date": attrs.get("publishAt", ""),
                })

            total = data.get("total", 0)
            offset += limit
            if offset >= total:
                break

        # Deduplicate by chapter_number, keep first occurrence
        seen = set()
        deduped = []
        for c in chapters:
            if c["chapter_number"] not in seen:
                seen.add(c["chapter_number"])
                deduped.append(c)

        return deduped

    except Exception as e:
        print(f"[MangaDex] get_chapters failed: {e}")
        return []


def get_pages(chapter_url):
    try:
        chapter_id = chapter_url.split("/chapter/")[-1].split("/")[0]

        r = client.get(f"{BASE_URL}/at-home/server/{chapter_id}")
        r.raise_for_status()
        data = r.json()

        server = data.get("baseUrl", "")
        chapter_hash = data.get("chapter", {}).get("hash", "")
        page_filenames = data.get("chapter", {}).get("data", [])

        return [
            {"page_number": i + 1, "image_url": f"{server}/data/{chapter_hash}/{filename}"}
            for i, filename in enumerate(page_filenames)
        ]

    except Exception as e:
        print(f"[MangaDex] get_pages failed: {e}")
        return []


if __name__ == "__main__":
    print("Searching One Piece...")
    results = search_manga("one piece")
    for r in results:
        print(r)

    if results:
        print("\nGetting chapters...")
        chapters = get_chapters(results[0]["url"])
        print(f"Found {len(chapters)} chapters")
        if chapters:
            print(f"First: {chapters[0]}")
            print(f"Latest: {chapters[-1]}")

            print("\nGetting pages from chapter 1...")
            pages = get_pages(chapters[0]["source_url"])
            print(f"Found {len(pages)} pages")
            if pages:
                print(f"First page: {pages[0]}")