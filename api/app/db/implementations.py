from contextlib import closing
from datetime import date
from logging import getLogger

from psycopg2 import connect # pyright: ignore[reportMissingModuleSource, reportMissingImports]

from .config import load_config


log = getLogger(__name__)

STAT_COLUMNS = ['started', 'attempts1', 'attempts2', 'attempts3', 'attempts4', 'attempts5', 'attempts6', 'attempts_plus', 'failures']


def _fetch_one(query: str, params: tuple) -> dict | None:
    # Errors propagate; main.py turns them into a generic 503 so nothing leaks to clients.
    with closing(connect(**load_config())) as conn, conn, conn.cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
        return dict(zip([desc[0] for desc in cur.description], row)) if row else None

def test_connection() -> dict:
    _fetch_one('SELECT 1', ())
    return {'application': 'up', 'db': 'up'}

def _increment(day: date, game_id: str, field: str) -> dict:
    if field not in STAT_COLUMNS:
        raise ValueError(f'Unknown stats column: {field}')
    row = _fetch_one(
        f"INSERT INTO results (gameId, date, {field}) VALUES (%s, %s, 1) "
        f"ON CONFLICT (gameId, date) DO UPDATE SET {field} = results.{field} + 1 RETURNING {field}",
        (game_id, day.isoformat()),
    )
    return {'date': day.isoformat(), 'gameId': game_id, field: row[field]}

def update_start(day: date, game_id: str) -> dict:
    return _increment(day, game_id, 'started')

def update_failed(day: date, game_id: str) -> dict:
    return _increment(day, game_id, 'failures')

def update_success(day: date, game_id: str, attempts: int) -> dict:
    return _increment(day, game_id, f'attempts{attempts}' if attempts <= 6 else 'attempts_plus')

def get_stats_by_game_and_date(game_id: str, day: date) -> dict:
    row = _fetch_one(
        f"SELECT {', '.join(STAT_COLUMNS)} FROM results WHERE gameId = %s AND date = %s",
        (game_id, day.isoformat()),
    )
    return {'gameId': game_id, 'date': day.isoformat(), **(row or dict.fromkeys(STAT_COLUMNS, 0))}
