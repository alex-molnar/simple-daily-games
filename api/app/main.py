from datetime import datetime
from fastapi import FastAPI, Response # pyright: ignore[reportMissingImports]

from .db.implementations import test_connection, save_new_game, update_start, update_failed, update_success, get_stats_by_game_and_date


app = FastAPI()


def wrap(data, endpoint: str, method: str, response: Response, status_code: int = 500):
    if type(data) == str:
        response.status_code = status_code
        return {"error": data, "endpoint": endpoint, "method": method}
    else:
        return data


@app.get("/health", status_code=200)
def health_check(response: Response):
    return wrap({'status': 'up'}, endpoint="/health", method="GET", response=response)

@app.get("/readiness", status_code=200)
def readiness_check(response: Response):
    return wrap(test_connection(), endpoint="/readiness", method="GET", response=response, status_code=503)

@app.post("/games/register/{gameId}", status_code=201)
def register_user(gameId: str, response: Response):
    return wrap(save_new_game(gameId), endpoint="/games/register/<gameId>", method="POST", response=response)

@app.post("/games/{gameId}/extend", status_code=201)
def register_user(gameId: str, response: Response):
    return wrap(save_new_game(gameId), endpoint="/games/register/<gameId>", method="POST", response=response)

@app.post("/games/{gameId}/date/{date}/start_game", status_code=200)
def start_game(gameId: str, date: str, response: Response):
    return wrap(update_start(date, gameId), endpoint="/games/<gameId>/date/<date>/start_game", method="POST", response=response)

@app.post("/games/{gameId}/date/{date}/failed_game", status_code=200)
def failed_game(gameId: str, date: str, response: Response):
    return wrap(update_failed(date, gameId), endpoint="/games/<gameId>/date/<date>/failed_game", method="POST", response=response)

@app.post("/games/{gameId}/date/{date}/success_game/{attempts}", status_code=200)
def success_game(gameId: str, date: str, attempts: int, response: Response = None):
    return (
        wrap(update_success(date, gameId, attempts), endpoint="/games/<gameId>/date/<date>/success_game/<attempts>", method="POST", response=response)
        if attempts > 0
        else wrap("Attempts must be greater than 0 for success_game endpoint", endpoint="/games/<gameId>/date/<date>/success_game/<attempts>", method="POST", response=response, status_code=400)
    )

@app.get("/games/{gameId}/date/{date}/stats", status_code=200)
def get_user_stats_endpoint(gameId: str, date: str, response: Response):
    return wrap(get_stats_by_game_and_date(gameId, date), endpoint="/games/<gameId>/date/<date>/stats", method="GET", response=response)

@app.get("/games/{gameId}/today", status_code=200)
def get_today_game(gameId: str, response: Response):
    return wrap(get_stats_by_game_and_date(gameId, datetime.now().strftime("%Y-%m-%d")), endpoint="/games/<gameId>/today", method="GET", response=response)
