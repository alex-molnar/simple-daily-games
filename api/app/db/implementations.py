from psycopg2 import connect # pyright: ignore[reportMissingModuleSource, reportMissingImports]
from uuid import uuid4

from .config import load_config


def test_connection() -> dict | str:
    config = load_config()
    try:
        with connect(**config) as _:
            print('Connected to the PostgreSQL server.')
            return {
                'application': 'up',
                'db': 'up'
            }
    except Exception as e:
        print(f'Error connecting to the PostgreSQL server: {e}')
        return "Couldn't connect to the PostgreSQL server"

def save_new_game(game_id: str, date: str) -> dict | str:
    config = load_config()
    try:
        with connect(**config) as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO results (date, gameId) VALUES (%s, %s)", (date, game_id))
                conn.commit()
                print(f'Inserted new game: {date} for game: {game_id}')
                return {
                    'date': date,
                    'gameId': game_id
                }
    except Exception as e:
        print(f'Error inserting new game: {e}')
        return str(e)

def _update_template(date: str, game_id: str, field: str) -> dict | str:
    config = load_config()
    try:
        with connect(**config) as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE results SET {field} = {field} + 1 WHERE date = %s AND gameId = %s RETURNING {field}", (date, game_id))
                value = cur.fetchone()[0]
                conn.commit()
                print(f'Updated {field} count for user: {date} and game: {game_id}')
                return {
                    'date': date,
                    'gameId': game_id,
                    field: value
                }
    except Exception as e:
        print(f'Error updating {field} count: {e}')
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
    try:
        with connect(**config) as conn:
            with conn.cursor() as cur:
                query = "SELECT * FROM results WHERE " + ' AND '.join([f"{key} = %s" for key in kwargs.keys()])
                cur.execute(query, tuple(kwargs.values()))
                result = cur.fetchone()
                if result:
                    columns = [desc[0] for desc in cur.description]
                    return dict(zip(columns, result))
                else:
                    return f"No results found for {kwargs}"
    except Exception as e:
        print(f'Error retrieving stats: {e}')
        return str(e)

def get_stats_by_game_and_date(game_id: str, date: str) -> dict | str:
    return get_stats_by(gameId=game_id, date=date)