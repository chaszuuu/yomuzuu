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
            "includes[]": ["cover_art"],
        })
        r.raise_for_status()
        data = r.json()

        results = []
        for item in data.get("data", []):
            attrs = item.get("attributes", {})

            # Title — prefer English
            title = attrs.get("title", {}).get("en")
            if not title:
                for alt in attrs.get("altTitles", []):
                    if "en" in alt:
                        title = alt["en"]
                        break
            if not title:
                title = next(iter(attrs.get("title", {}).values()), "")

            # Alt title — first non-English alt
            alt_title = None
            for alt in attrs.get("altTitles", []):
                for lang, val in alt.items():
                    if lang != "en" and val:
                        alt_title = val
                        break
                if alt_title:
                    break

            # Cover
            cover = None
            for rel in item.get("relationships", []):
                if rel.get("type") == "cover_art":
                    filename = rel.get("attributes", {}).get("fileName")
                    if filename:
                        cover = f"https://uploads.mangadex.org/covers/{item['id']}/{filename}.256.jpg"
                    break

            # Description
            description = attrs.get("description", {}).get("en") or next(
                iter(attrs.get("description", {}).values()), None
            )

            # Genres from tags
            genres = ", ".join([
                tag["attributes"]["name"]["en"]
                for tag in attrs.get("tags", [])
                if tag.get("attributes", {}).get("group") == "genre"
                and "en" in tag.get("attributes", {}).get("name", {})
            ]) or None

            # Score
            rating = attrs.get("rating", {})
            score = str(round(float(rating.get("average") or 0), 2)) if rating.get("average") else None

            # Type
            original_lang = attrs.get("originalLanguage", "")
            if original_lang == "ko":
                manga_type = "manhwa"
            elif original_lang == "zh" or original_lang == "zh-hk":
                manga_type = "manhua"
            else:
                manga_type = "manga"

            results.append({
                "title": title,
                "url": f"{BASE_URL}/manga/{item['id']}",
                "cover": cover,
                "description": description,
                "genres": genres,
                "score": score,
                "type": manga_type,
                "alt_title": alt_title,
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