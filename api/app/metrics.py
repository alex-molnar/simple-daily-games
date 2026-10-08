from contextlib import asynccontextmanager
from os import getenv
from re import compile, IGNORECASE
from time import perf_counter

from prometheus_client import Counter, Gauge, Histogram, start_http_server # pyright: ignore[reportMissingImports]

# Every name carries the app prefix, so one Prometheus can hold several apps without their metrics mixing.
# Served on its own port, which the Service names but the ingress never routes to, so it stays in-cluster.
METRICS_PORT = int(getenv("METRICS_PORT", "9100"))

# Probes would drown out player traffic in the request metrics.
PROBE_ROUTES = {"/health", "/readiness"}
KNOWN_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}

HTTP_REQUESTS = Counter("simple_daily_games_http_requests_total", "HTTP requests handled", ["method", "route", "status"])
HTTP_DURATION = Histogram("simple_daily_games_http_request_duration_seconds", "HTTP request duration", ["method", "route"])
DB_UP = Gauge("simple_daily_games_db_up", "1 if the last database check succeeded, 0 if it failed")

GAME_STARTED = Counter("simple_daily_games_game_started_total", "Games started", ["game"])
GAME_WON = Counter("simple_daily_games_game_won_total", "Games won, by number of attempts (1-6, 7+)", ["game", "attempts"])
GAME_FAILED = Counter("simple_daily_games_game_failed_total", "Games failed or given up", ["game"])
PAGE_VIEWS = Counter("simple_daily_games_page_views_total", "Page views, by coarse client class", ["game", "browser", "os", "device"])

# First match wins, so more specific agents go first (Edge and Opera also say Chrome, iPads also say Mac OS X).
BROWSERS = [("edge", compile(r"Edg(e|A|iOS)?/")), ("opera", compile(r"OPR/|Opera")), ("firefox", compile(r"Firefox|FxiOS")),
            ("chrome", compile(r"Chrome|CriOS|Chromium")), ("safari", compile(r"Safari"))]
OSES = [("ios", compile(r"iPhone|iPad|iPod")), ("android", compile(r"Android")), ("windows", compile(r"Windows")),
        ("macos", compile(r"Mac OS X|Macintosh")), ("chromeos", compile(r"CrOS")), ("linux", compile(r"Linux|X11"))]
BOT = compile(r"bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python-requests|httpclient", IGNORECASE)
TABLET = compile(r"iPad|Tablet")
MOBILE = compile(r"Mobi|iPhone|iPod")
ANDROID = compile(r"Android")


def _first(patterns, ua: str) -> str:
    return next((name for name, pattern in patterns if pattern.search(ua)), "other")


def classify_user_agent(ua: str) -> tuple[str, str, str]:
    """(browser, os, device), each from a fixed list so label cardinality stays bounded. No raw agent is kept."""
    if BOT.search(ua):
        return "other", "other", "bot"
    # ponytail: iPadOS 13+ sends a Macintosh agent and shows up as a macOS desktop. Needs client-side detection to fix.
    if TABLET.search(ua) or (ANDROID.search(ua) and not MOBILE.search(ua)):
        device = "tablet"
    elif MOBILE.search(ua) or ANDROID.search(ua):
        device = "mobile"
    else:
        device = "desktop"
    return _first(BROWSERS, ua), _first(OSES, ua), device


def attempts_label(attempts: int) -> str:
    return str(attempts) if attempts <= 6 else "7+"


async def metrics_middleware(request, call_next):
    start = perf_counter()
    status = 500  # call_next raises on an unhandled error, which the server turns into a 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        # The route template, not the URL, so cardinality stays bounded. Unmatched paths share one label.
        route = getattr(request.scope.get("route"), "path", "unmatched")
        method = request.method if request.method in KNOWN_METHODS else "other"
        if route not in PROBE_ROUTES:
            HTTP_REQUESTS.labels(method, route, status).inc()
            HTTP_DURATION.labels(method, route).observe(perf_counter() - start)


@asynccontextmanager
async def lifespan(app):
    start_http_server(METRICS_PORT)
    yield
