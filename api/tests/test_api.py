from datetime import date, datetime, timezone
from os import getenv
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient # pyright: ignore[reportMissingImports]
from psycopg2 import OperationalError # pyright: ignore[reportMissingModuleSource, reportMissingImports]

from app import main
from app.db import implementations as db

client = TestClient(main.app, raise_server_exceptions=False)


@pytest.mark.parametrize("method, path", [
    ("post", "/games/nope/today/start_game"),
    ("get", "/games/nope/today/stats"),
    ("post", "/games/capitale/today/success_game/0"),
])
def test_invalid_input_is_rejected(method, path):
    assert getattr(client, method)(path).status_code == 422


def test_database_errors_are_not_sent_to_clients(monkeypatch):
    def boom(*args):
        raise OperationalError('FATAL: password authentication failed for user "secret-user"')
    monkeypatch.setattr(main, "update_start", boom)
    response = client.post("/games/capitale/today/start_game")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


@pytest.mark.parametrize("path", [
    "/games/register/capitale",
    "/games/capitale/extend",
    "/games/capitale/date/2001-02-03/start_game",  # only today's row can be written, so curl cannot create rows for other days
    "/games/capitale/date/2001-02-03/stats",
])
def test_removed_endpoints_are_gone(path):
    assert client.post(path).status_code in (404, 405)
    assert client.get(path).status_code in (404, 405)


def test_today_is_utc(monkeypatch):
    seen = []
    monkeypatch.setattr(main, "update_start", lambda day, game: seen.append(day) or {})
    client.post("/games/capitale/today/start_game")
    assert seen == [main.today()]
    assert main.today() == datetime.now(timezone.utc).date()


def test_unknown_stats_column_is_refused():
    with pytest.raises(ValueError):
        db._increment(date(2001, 2, 3), "capitale", "started; DROP TABLE results")


needs_db = pytest.mark.skipif(not getenv("POSTGRES_HOSTNAME"), reason="needs a Postgres with api/db/setup-env.sql applied")


@needs_db
def test_first_write_creates_the_row_and_later_writes_count_up():
    # A fresh game id per run, so a rerun against the same database starts from zero.
    game, day = f"test-{uuid4()}", date(2001, 2, 3)
    assert db.get_stats_by_game_and_date(game, day)["started"] == 0
    assert db.update_start(day, game)["started"] == 1
    assert db.update_start(day, game)["started"] == 2
    assert db.update_success(day, game, 3)["attempts3"] == 1
    assert db.update_success(day, game, 67)["attempts_plus"] == 1
    assert db.update_failed(day, game)["failures"] == 1
    body = db.get_stats_by_game_and_date(game, day)
    assert (body["started"], body["attempts3"], body["attempts_plus"], body["failures"]) == (2, 1, 1, 1)


@needs_db
def test_counters_do_not_overflow_a_smallint():
    game, day = f"test-{uuid4()}", date(2001, 2, 3)
    db._fetch_one("INSERT INTO results (gameId, date, started) VALUES (%s, %s, 32767) RETURNING started", (game, day.isoformat()))
    assert db.update_start(day, game)["started"] == 32768


@needs_db
def test_http_writes_count_up_for_today():
    before = client.get("/games/grayscale/today/stats").json()["started"]
    assert client.post("/games/grayscale/today/start_game").json()["started"] == before + 1
