from os import getenv

import pytest
from fastapi.testclient import TestClient # pyright: ignore[reportMissingImports]
from psycopg2 import OperationalError # pyright: ignore[reportMissingModuleSource, reportMissingImports]

from app import main

client = TestClient(main.app, raise_server_exceptions=False)


@pytest.mark.parametrize("method, path", [
    ("post", "/games/nope/today/start_game"),
    ("get", "/games/nope/today/stats"),
    ("post", "/games/capitale/today/success_game/0"),
    ("post", "/games/capitale/date/not-a-date/start_game"),
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


def test_removed_endpoints_are_gone():
    assert client.post("/games/register/capitale").status_code in (404, 405)
    assert client.post("/games/capitale/extend").status_code in (404, 405)


@pytest.mark.skipif(not getenv("POSTGRES_HOSTNAME"), reason="needs a Postgres with api/db/setup-env.sql applied")
def test_first_write_creates_the_row_and_later_writes_count_up():
    game, day = "grayscale", "2001-02-03"
    stats = f"/games/{game}/date/{day}/stats"
    assert client.get(stats).json()["started"] == 0
    assert client.post(f"/games/{game}/date/{day}/start_game").json()["started"] == 1
    assert client.post(f"/games/{game}/date/{day}/start_game").json()["started"] == 2
    assert client.post(f"/games/{game}/date/{day}/success_game/3").json()["attempts3"] == 1
    assert client.post(f"/games/{game}/date/{day}/success_game/67").json()["attempts_plus"] == 1
    assert client.post(f"/games/{game}/date/{day}/failed_game").json()["failures"] == 1
    body = client.get(stats).json()
    assert (body["started"], body["attempts3"], body["attempts_plus"], body["failures"]) == (2, 1, 1, 1)
