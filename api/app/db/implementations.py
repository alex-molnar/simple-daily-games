from logging import getLogger

from psycopg2 import connect # pyright: ignore[reportMissingModuleSource, reportMissingImports]
from datetime import datetime, timedelta

from .config import load_config


log = getLogger(__name__)


def test_connection() -> dict | str:
    config = load_config()
    log.debug(f'Loaded database configuration: {config}')
    try:
        with connect(**config) as _:
            log.info('Connected to the PostgreSQL server.')
            return {
                'application': 'up',
                'db': 'up'
            }
    except Exception as e:
        log.error(f'Error connecting to the PostgreSQL server: {e}')
        return "Couldn't connect to the PostgreSQL server"

def save_new_game(game_id: str) -> dict | str:
    config = load_config()
    log.debug(f'Loaded database configuration: {config}')
    try:
        with connect(**config) as conn:
            with conn.cursor() as cur:
                query = "INSERT INTO results (date, gameId) VALUES " + ", ".join(["(%s, %s)"] * 365) + " ON CONFLICT (date, gameId) DO NOTHING"
                now = datetime.now()
                gameIds = [game_id] * 365
                dates = [(now + timedelta(days=day)).strftime("%Y-%m-%d") for day in range(365)]
                cur.execute(query, tuple([item for pair in zip(dates, gameIds) for item in pair]))
                log.debug(f'Executed query: {query} with parameters: {list(zip(dates, gameIds))}')
                conn.commit()
                log.info(f'Inserted rows for a year  game {game_id}')
                return {
                    'gameId': game_id,
                    "message": "Game dates saved for the next 365 days"
                }
    except Exception as e:
        log.error(f'Error inserting new game: {e}')
        return str(e)

def _update_template(date: str, game_id: str, field: str) -> dict | str:
    config = load_config()
    log.debug(f'Loaded database configuration: {config}')
    try:
        with connect(**config) as conn:
            with conn.cursor() as cur:
                query = f"UPDATE results SET {field} = {field} + 1 WHERE date = %s AND gameId = %s RETURNING {field}"
                cur.execute(query, (date, game_id))
                log.debug(f'Executed query: {query} with parameters: {(date, game_id)}')
                value = cur.fetchone()
                conn.commit()
                if value:
                    log.debug(f'Updated {field} count for game {game_id} on date {date}: {value[0]}')
                    return {
                        'date': date,
                        'gameId': game_id,
                        field: value[0]
                    }
                else:
                    log.warning(f'No rows updated for game {game_id} on date {date}. Check if the gameId and date exist.')
                    return f"No rows updated for gameId: {game_id} on date: {date}. Check if the gameId and date exist."
    except Exception as e:
        log.error(f'Error updating {field} count: {e}')
        return str(e)

def update_start(date: str, game_id: str) -> dict | str:
    return _update_template(date, game_id, 'started')

def update_failed(date: str, game_id: str) -> dict | str:
    return _update_template(date, game_id, 'failures')

def update_success(date: str, game_id: str, attempts: int) -> dict | str:
    return (
        _update_template(date, game_id, f'attempts{attempts}')
        if attempts <= 6
        else _update_template(date, game_id, 'attempts_plus')
    )

def get_stats_by(**kwargs) -> dict | str:
    if not kwargs:
        return "No parameters provided for stats retrieval"
    config = load_config()
    log.debug(f'Loaded database configuration: {config}')
    try:
        with connect(**config) as conn:
            with conn.cursor() as cur:
                query = "SELECT * FROM results WHERE " + ' AND '.join([f"{key} = %s" for key in kwargs.keys()])
                cur.execute(query, tuple(kwargs.values()))
                log.debug(f'Executed query: {query} with parameters: {tuple(kwargs.values())}')
                result = cur.fetchone()
                if result:
                    log.info(f'Fetched results for parameters: {kwargs}')
                    columns = [desc[0] for desc in cur.description]
                    return dict(zip(columns, result))
                else:
                    log.warning(f'No results found for parameters: {kwargs}')
                    return f"No results found for {kwargs}"
    except Exception as e:
        log.error(f'Error retrieving stats: {e}')
        return str(e)

def get_stats_by_game_and_date(game_id: str, date: str) -> dict | str:
    return get_stats_by(gameId=game_id, date=date)