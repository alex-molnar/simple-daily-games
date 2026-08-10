from datetime import datetime
from fastapi import FastAPI, Response # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from logging import basicConfig, getLogger, INFO
from os import getenv

from .db.implementations import test_connection, save_new_game, update_start, update_failed, update_success, get_stats_by_game_and_date


app = FastAPI()

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = getLogger(__name__)

basicConfig(
    level=getenv("LOG_LEVEL", INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


def wrap(data, endpoint: str, method: str, response: Response, status_code: int = 500):
    if method == "GET":
        response.headers["Content-Type"] = "application/json"
    if type(data) == str:
        response.status_code = status_code
        log.debug(f'Responding with error for {method} {endpoint}: {data}')
        return {"error": data, "endpoint": endpoint, "method": method}
    else:
        log.debug(f'Responding with data for {method} {endpoint}: {data}')
        return data

def log_request(endpoint: str, method: str, kwargs: dict = {}, data = None):
    log.debug(f"Received request for {method} {endpoint} with parameters: {kwargs} and body: {data}")


@app.get("/health", status_code=200)
def health_check(response: Response):
    log_request(endpoint="/health", method="GET")
    return wrap({'status': 'up'}, endpoint="/health", method="GET", response=response)

@app.get("/readiness", status_code=200)
def readiness_check(response: Response):
    log_request(endpoint="/readiness", method="GET")
    return wrap(test_connection(), endpoint="/readiness", method="GET", response=response, status_code=503)

@app.post("/games/register/{gameId}", status_code=201)
def register_user(gameId: str, response: Response):
    log_request(endpoint="/games/register/<gameId>", method="POST", kwargs={"gameId": gameId})
    return wrap(save_new_game(gameId), endpoint="/games/register/<gameId>", method="POST", response=response)

@app.post("/games/{gameId}/extend", status_code=201)
def extend_game(gameId: str, response: Response):
    log_request(endpoint="/games/<gameId>/extend", method="POST", kwargs={"gameId": gameId})
    return wrap(save_new_game(gameId), endpoint="/games/<gameId>/extend", method="POST", response=response)

@app.post("/games/{gameId}/date/{date}/start_game", status_code=200)
def start_game(gameId: str, date: str, response: Response):
    log_request(endpoint="/games/<gameId>/date/<date>/start_game", method="POST", kwargs={"gameId": gameId, "date": date})
    return wrap(update_start(date, gameId), endpoint="/games/<gameId>/date/<date>/start_game", method="POST", response=response)

@app.post("/games/{gameId}/today/start_game", status_code=200)
def start_game_today(gameId: str, response: Response):
    today = datetime.now().strftime("%Y-%m-%d")
    log_request(endpoint="/games/<gameId>/today/start_game", method="POST", kwargs={"gameId": gameId, "date": today})
    return wrap(update_start(today, gameId), endpoint="/games/<gameId>/today/start_game", method="POST", response=response)

@app.post("/games/{gameId}/date/{date}/failed_game", status_code=200)
def failed_game(gameId: str, date: str, response: Response):
    log_request(endpoint="/games/<gameId>/date/<date>/failed_game", method="POST", kwargs={"gameId": gameId, "date": date})
    return wrap(update_failed(date, gameId), endpoint="/games/<gameId>/date/<date>/failed_game", method="POST", response=response)

@app.post("/games/{gameId}/today/failed_game", status_code=200)
def failed_game_today(gameId: str, response: Response):
    today = datetime.now().strftime("%Y-%m-%d")
    log_request(endpoint="/games/<gameId>/today/failed_game", method="POST", kwargs={"gameId": gameId, "date": today})
    return wrap(update_failed(today, gameId), endpoint="/games/<gameId>/today/failed_game", method="POST", response=response)

@app.post("/games/{gameId}/date/{date}/success_game/{attempts}", status_code=200)
def success_game(gameId: str, date: str, attempts: int, response: Response = None):
    log_request(endpoint="/games/<gameId>/date/<date>/success_game/<attempts>", method="POST", kwargs={"gameId": gameId, "date": date, "attempts": attempts})
    return (
        wrap(update_success(date, gameId, attempts), endpoint="/games/<gameId>/date/<date>/success_game/<attempts>", method="POST", response=response)
        if attempts > 0
        else wrap("Attempts must be greater than 0 for success_game endpoint", endpoint="/games/<gameId>/date/<date>/success_game/<attempts>", method="POST", response=response, status_code=400)
    )

@app.post("/games/{gameId}/today/success_game/{attempts}", status_code=200)
def success_game_today(gameId: str, attempts: int, response: Response = None):
    today = datetime.now().strftime("%Y-%m-%d")
    log_request(endpoint="/games/<gameId>/today/success_game/<attempts>", method="POST", kwargs={"gameId": gameId, "attempts": attempts, "date": today})
    return (
        wrap(update_success(today, gameId, attempts), endpoint="/games/<gameId>/today/success_game/<attempts>", method="POST", response=response)
        if attempts > 0
        else wrap("Attempts must be greater than 0 for success_game endpoint", endpoint="/games/<gameId>/today/success_game/<attempts>", method="POST", response=response, status_code=400)
    )

@app.get("/games/{gameId}/date/{date}/stats", status_code=200)
def get_user_stats_endpoint(gameId: str, date: str, response: Response):
    log_request(endpoint="/games/<gameId>/date/<date>/stats", method="GET", kwargs={"gameId": gameId, "date": date})
    return wrap(get_stats_by_game_and_date(gameId, date), endpoint="/games/<gameId>/date/<date>/stats", method="GET", response=response)

@app.get("/games/{gameId}/today/stats", status_code=200)
def get_today_game(gameId: str, response: Response):
    log_request(endpoint="/games/<gameId>/today/stats", method="GET", kwargs={"gameId": gameId, "date": datetime.now().strftime("%Y-%m-%d")})
    return wrap(get_stats_by_game_and_date(gameId, datetime.now().strftime("%Y-%m-%d")), endpoint="/games/<gameId>/today/stats", method="GET", response=response)
