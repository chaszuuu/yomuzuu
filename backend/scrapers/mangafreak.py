import re
import cloudscraper
from bs4 import BeautifulSoup

BASE_URL = "https://ww2.mangafreak.me"

client = cloudscraper.create_scraper()


def search_manga(query):
    r = client.get(f"{BASE_URL}/Find/{query}")
    soup = BeautifulSoup(r.text, "html.parser")

    results = []
    for el in soup.select("div.manga_search_item, div.mangaka_search_item"):
        a = el.select_one("h3 a, h5 a")
        img = el.select_one("img")
        if not a:
            continue
        results.append({
            "title": a.text.strip(),
            "url": BASE_URL + a["href"],
            "thumbnail": img["src"] if img else ""
        })
    return results



def get_chapters(manga_url):
    if not manga_url.startswith("http"):
        manga_url = BASE_URL + manga_url

    r = client.get(manga_url)
    soup = BeautifulSoup(r.text, "html.parser")

    slug = manga_url.split("/Manga/")[-1]  # e.g. "One_Piece"

    seen_urls = set()
    chapters = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Match /Read1_One_Piece_1174 or /Read1_One_Piece_1053a
        # The chapter identifier must START with a digit to exclude variants like _Colored_1
        if not re.match(rf"^/Read1_{re.escape(slug)}_\d+\w*$", href):
            continue
        if href in seen_urls:
            continue
        seen_urls.add(href)

        name = a.text.strip()
        if not name:
            continue

        # Extract just the chapter number e.g. "1174" or "1053a" from end of href
        chapter_number = href.rsplit("_", 1)[-1]

        chapters.append({
            "chapter_number": chapter_number,
            "title": name,
            "source_url": BASE_URL + href,
            "date": ""
        })

    chapters.sort(key=lambda x: float(re.sub(r'[a-z]', '', x["chapter_number"]) or 0))
    return chapters

def get_pages(chapter_url):
    if not chapter_url.startswith("http"):
        chapter_url = BASE_URL + chapter_url
    r = client.get(chapter_url)
    soup = BeautifulSoup(r.text, "html.parser")

    pages = []
    for i, img in enumerate(soup.select("img#gohere[src]")):
        pages.append({
            "page_number": i + 1,
            "image_url": img["src"]
        })
    return pages


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