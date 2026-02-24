from playwright.sync_api import sync_playwright

BASE_URL = "https://mangafire.to"

def scrape_chapters(manga_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto(manga_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)

        # Save HTML so you can inspect the chapter structure
        html = page.content()
        with open("debug_manga.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Saved debug_manga.html — open it and Ctrl+F for 'chapter-1'")

        # Try multiple selectors
        selectors = [
            "a[href*='/read/']",
            ".chapter-list a",
            "#chapter-list a",
            "[class*='chapter'] a",
            "ul.list-group a",
        ]
        for sel in selectors:
            els = page.query_selector_all(sel)
            if els:
                print(f"'{sel}' → {len(els)} elements, sample: {els[0].get_attribute('href')}")

        browser.close()
        return []


def scrape_pages(chapter_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        seen = set()
        image_urls = []

        def handle_response(response):
            if response.request.resource_type == "image":
                url = response.url
                if "/assets/" in url:  # skip UI/logo images
                    return
                if any(ext in url for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                    if url not in seen:
                        seen.add(url)
                        image_urls.append(url)

        page.on("response", handle_response)
        page.goto(chapter_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector("body", timeout=15000)
        page.wait_for_timeout(2000)

        # Step scroll to trigger lazy loading
        scroll_step = 800
        current = 0
        while True:
            page.evaluate(f"window.scrollTo(0, {current})")
            page.wait_for_timeout(500)
            current += scroll_step
            bottom = page.evaluate("document.body.scrollHeight")
            if current >= bottom:
                page.wait_for_timeout(2000)
                new_bottom = page.evaluate("document.body.scrollHeight")
                if new_bottom == bottom:
                    break

        page.wait_for_timeout(2000)
        browser.close()

        return [{"page_number": i + 1, "image_url": url} for i, url in enumerate(image_urls)]


if __name__ == "__main__":
    print("Scraping One Piece chapters...")
    chapters = scrape_chapters(f"{BASE_URL}/manga/one-piece.dkw")  # no double-e
    print(f"Found {len(chapters)} chapters\n")

    print("Scraping pages from chapter 1...")
    pages = scrape_pages(f"{BASE_URL}/read/one-piece.dkw/en/chapter-1")  # no double-e
    print(f"Found {len(pages)} pages")
    if pages:
        print(f"First page: {pages[0]}")