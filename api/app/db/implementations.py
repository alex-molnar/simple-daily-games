from psycopg2 import connect # pyright: ignore[reportMissingModuleSource, reportMissingImports]
from uuid import uuid4

from .config import load_config


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
