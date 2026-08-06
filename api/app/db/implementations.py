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

def save_new_user(game_id: str) -> dict | str:
    config = load_config()
    try:
        with connect(**config) as conn:
            id = str(uuid4())
            with conn.cursor() as cur:
                cur.execute("INSERT INTO results (userId, gameId) VALUES (%s, %s)", (id, game_id))
                conn.commit()
                print(f'Inserted new user: {id} for game: {game_id}')
                return {
                    'userId': id,
                    'gameId': game_id
                }
    except Exception as e:
        print(f'Error inserting new user: {e}')
        return str(e)

def _update_template(user_id: str, game_id: str, field: str) -> dict | str:
    config = load_config()
    try:
        with connect(**config) as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE results SET {field} = {field} + 1 WHERE userId = %s AND gameId = %s RETURNING {field}", (user_id, game_id))
                value = cur.fetchone()[0]
                conn.commit()
                print(f'Updated {field} count for user: {user_id} and game: {game_id}')
                return {
                    'userId': user_id,
                    'gameId': game_id,
                    field: value
                }
    except Exception as e:
        print(f'Error updating {field} count: {e}')
        return str(e)

def update_start(user_id: str, game_id: str) -> dict | str:
    return _update_template(user_id, game_id, 'started')

def update_failed(user_id: str, game_id: str) -> dict | str:
    return _update_template(user_id, game_id, 'failures')

def update_success(user_id: str, game_id: str, attempts: int) -> dict | str:
    return (
        _update_template(user_id, game_id, f'attempts{attempts}')
        if attempts <= 6
        else _update_template(user_id, game_id, 'attempts_plus')
    )