import httpx
import time
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def get_manga_links(page=0):
    url = f"https://myanimelist.net/topmanga.php?limit={page * 50}"
    response = httpx.get(url, headers=HEADERS)
    soup = BeautifulSoup(response.text, "html.parser")
    
    links = soup.select("a.hoverinfo_trigger")
    manga_urls = []
    
    for link in links:
        href = link.get("href")
        if href and "/manga/" in href:
            if href not in manga_urls:
                manga_urls.append(href)
    
    return manga_urls


def scrape_manga(url):
    response = httpx.get(url, headers=HEADERS, timeout=15)
    soup = BeautifulSoup(response.text, "html.parser")

    title_tag = soup.select_one("title")
    if title_tag:
        title_text = title_tag.text.split("|")[0].strip()
    else:
        title_text = None

    cover = soup.select_one("img[itemprop='image']")
    description = soup.select_one("span[itemprop='description']")
    genres = soup.select("a[href*='/manga/genre/']")
    score = soup.select_one("div.score-label")

    return {
        "title": title_text,
        "cover": cover.get("src") or cover.get("data-src") if cover else None,
        "description": description.text.strip() if description else None,
        "genres": ", ".join([g.text.strip() for g in genres]) if genres else None,
        "score": score.text.strip() if score else None,
        "source_url": url
    }


if __name__ == "__main__":
    import sys
    sys.path.append("D:/projects/yomuzuu/backend")
    from database import SessionLocal, init_db
    from models import Manga

    init_db()
    db = SessionLocal()

    print("Fetching manga links...")
    links = get_manga_links(page=0)
    print(f"Found {len(links)} manga")

    for url in links:
        print(f"Scraping {url}...")
        try:
            data = scrape_manga(url)
        except Exception as e:
            print(f"Failed: {url} → {e}")
            continue

        if data["title"]:
            existing = db.query(Manga).filter(Manga.source_url == url).first()
            if not existing:
                manga = Manga(
                    title=data["title"],
                    cover=data["cover"],
                    description=data["description"],
                    genres=data["genres"],
                    score=data["score"],
                    source_url=data["source_url"]
                )
                db.add(manga)
                db.commit()
                print(f"Saved: {data['title']}")
            else:
                existing.title = data["title"]
                db.commit()
                print(f"Updated: {data['title']}")

        time.sleep(2)



    db.close()
    print("Done!")