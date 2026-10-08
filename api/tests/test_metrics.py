import pytest
from fastapi.testclient import TestClient # pyright: ignore[reportMissingImports]
from prometheus_client import REGISTRY # pyright: ignore[reportMissingImports]
from psycopg2 import OperationalError # pyright: ignore[reportMissingModuleSource, reportMissingImports]

from app import main
from app.metrics import attempts_label, classify_user_agent

client = TestClient(main.app, raise_server_exceptions=False)


def sample(name, **labels):
    return REGISTRY.get_sample_value(name, labels) or 0


IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
IPAD = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1"
ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
WINDOWS_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0"
MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
LINUX_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"
MAC_OPERA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 OPR/106.0"


@pytest.mark.parametrize("ua, expected", [
    (IPHONE, ("safari", "ios", "mobile")),
    (IPAD, ("chrome", "ios", "tablet")),
    (ANDROID_PHONE, ("chrome", "android", "mobile")),
    (ANDROID_TABLET, ("chrome", "android", "tablet")),
    (WINDOWS_EDGE, ("edge", "windows", "desktop")),
    (MAC_SAFARI, ("safari", "macos", "desktop")),
    (LINUX_FIREFOX, ("firefox", "linux", "desktop")),
    (MAC_OPERA, ("opera", "macos", "desktop")),
    ("Googlebot/2.1 (+http://www.google.com/bot.html)", ("other", "other", "bot")),
    ("curl/8.4.0", ("other", "other", "bot")),
    ("", ("other", "other", "desktop")),
    ("totally-made-up-agent", ("other", "other", "desktop")),
])
def test_user_agent_is_classified_into_coarse_classes(ua, expected):
    assert classify_user_agent(ua) == expected


def test_attempts_are_bucketed():
    assert [attempts_label(n) for n in (1, 6, 7, 67)] == ["1", "6", "7+", "7+"]


def test_visit_counts_a_page_view_without_storing_the_agent():
    labels = dict(game="capitale", browser="safari", os="macos", device="desktop")
    before = sample("page_views_total", **labels)
    response = client.post("/games/capitale/today/visit", headers={"User-Agent": MAC_SAFARI})
    assert response.status_code == 204
    assert sample("page_views_total", **labels) == before + 1


def test_landing_page_can_report_a_visit_but_is_not_a_game():
    assert client.post("/games/landing/today/visit", headers={"User-Agent": MAC_SAFARI}).status_code == 204
    assert client.post("/games/landing/today/start_game").status_code == 422  # no result rows for it
    assert client.post("/games/nope/today/visit").status_code == 422


def test_game_events_are_counted_after_the_database_write(monkeypatch):
    monkeypatch.setattr(main, "update_start", lambda day, game: {})
    monkeypatch.setattr(main, "update_success", lambda day, game, attempts: {})
    monkeypatch.setattr(main, "update_failed", lambda day, game: {})
    before = (sample("game_started_total", game="grayscale"), sample("game_won_total", game="grayscale", attempts="3"),
              sample("game_won_total", game="grayscale", attempts="7+"), sample("game_failed_total", game="grayscale"))
    client.post("/games/grayscale/today/start_game")
    client.post("/games/grayscale/today/success_game/3")
    client.post("/games/grayscale/today/success_game/67")
    client.post("/games/grayscale/today/failed_game")
    assert (sample("game_started_total", game="grayscale"), sample("game_won_total", game="grayscale", attempts="3"),
            sample("game_won_total", game="grayscale", attempts="7+"), sample("game_failed_total", game="grayscale")) \
        == tuple(n + 1 for n in before)


def test_a_failed_database_write_is_not_counted(monkeypatch):
    def boom(*args):
        raise OperationalError("down")
    monkeypatch.setattr(main, "update_start", boom)
    before = sample("game_started_total", game="countryle")
    assert client.post("/games/countryle/today/start_game").status_code == 503
    assert sample("game_started_total", game="countryle") == before


def test_requests_are_labelled_by_route_template_not_url(monkeypatch):
    monkeypatch.setattr(main, "get_stats_by_game_and_date", lambda game, day: {})
    labels = dict(method="GET", route="/games/{game_id}/today/stats", status="200")
    before = sample("http_requests_total", **labels)
    client.get("/games/capitale/today/stats")
    client.get("/games/invertedle/today/stats")
    assert sample("http_requests_total", **labels) == before + 2


def test_unknown_paths_and_methods_share_bounded_labels():
    unmatched = dict(method="other", route="unmatched", status="404")
    before = sample("http_requests_total", **unmatched)
    client.request("BREW", "/random-path-1")
    client.request("BREW", "/random-path-2")
    assert sample("http_requests_total", **unmatched) == before + 2


def test_probes_are_not_counted_as_traffic(monkeypatch):
    monkeypatch.setattr(main, "test_connection", lambda: {"db": "up"})
    before = sample("http_requests_total", method="GET", route="/health", status="200")
    client.get("/health")
    client.get("/readiness")
    assert sample("http_requests_total", method="GET", route="/health", status="200") == before
    assert sample("http_requests_total", method="GET", route="/readiness", status="200") == 0


def test_database_health_gauge_follows_readiness(monkeypatch):
    monkeypatch.setattr(main, "test_connection", lambda: {"db": "up"})
    assert client.get("/readiness").status_code == 200
    assert sample("app_db_up") == 1

    def boom():
        raise OperationalError("down")
    monkeypatch.setattr(main, "test_connection", boom)
    assert client.get("/readiness").status_code == 503
    assert sample("app_db_up") == 0
