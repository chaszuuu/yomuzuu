import httpx
import cloudscraper
from urllib.parse import urlparse
from flask import Response, request, Blueprint

proxy_bp = Blueprint("proxy", __name__)
scraper = cloudscraper.create_scraper()

ALLOWED_HOSTS = {
    "cdn.myanimelist.net",
    "myanimelist.cdn-dena.com",
    "ww2.mangafreak.me",
    "mangafreak.me",
    "s1.mangafreak.me",
    "s2.mangafreak.me",
    "s3.mangafreak.me",
}

@proxy_bp.route("/proxy")
def proxy():
    # Note: rate limiting is applied via the default limiter in app.py
    # (proxy_bp is no longer exempt)
    image_url = request.args.get("url")
    if not image_url:
        return "No URL provided", 400

    # Validate URL and check against whitelist
    try:
        parsed = urlparse(image_url)
        hostname = parsed.hostname or ""
        # Allow exact match or subdomain match
        allowed = any(
            hostname == h or hostname.endswith("." + h)
            for h in ALLOWED_HOSTS
        )
        if not allowed:
            return "Forbidden", 403
    except Exception:
        return "Invalid URL", 400

    try:
        if "mangafreak.me" in image_url:
            headers = {
                "Referer": "https://ww2.mangafreak.me",
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
            }
            response = scraper.get(image_url, headers=headers, timeout=10)
        else:
            headers = {
                "Referer": "https://myanimelist.net",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            response = httpx.get(image_url, headers=headers, timeout=10)

        return Response(
            response.content,
            content_type=response.headers.get("content-type", "image/jpeg")
        )
    except Exception as e:
        return f"Failed to fetch image: {e}", 500