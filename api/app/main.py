from datetime import date as Date
from fastapi import FastAPI, Path, Request # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from fastapi.responses import JSONResponse # pyright: ignore[reportMissingImports]
from logging import basicConfig, getLogger, INFO
from os import getenv
from typing import Annotated, Literal

from psycopg2 import Error as DatabaseError # pyright: ignore[reportMissingModuleSource, reportMissingImports]

from .db.implementations import test_connection, update_start, update_failed, update_success, get_stats_by_game_and_date


app = FastAPI()

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=getenv("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_credentials=getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true",
    allow_methods=getenv("CORS_ALLOW_METHODS", "*").split(","),
    allow_headers=getenv("CORS_ALLOW_HEADERS", "*").split(","),
)

log = getLogger(__name__)

basicConfig(
    level=getenv("LOG_LEVEL", INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

# Rows are created on first write, so this is what stops anyone from creating rows for any name.
GameId = Literal["capitale", "countryle", "grayscale", "invertedle"]
Attempts = Annotated[int, Path(ge=1)]


@app.exception_handler(DatabaseError)
def database_error(request: Request, exc: DatabaseError):
    log.error(f'Database error on {request.method} {request.url.path}: {exc}')
    return JSONResponse({"detail": "Database unavailable"}, status_code=503)

def today() -> Date:
    return Date.today()


@app.get("/health")
def health_check():
    return {'status': 'up'}

@app.get("/readiness")
def readiness_check():
    return test_connection()

@app.post("/games/{game_id}/date/{date}/start_game")
def start_game(game_id: GameId, date: Date):
    return update_start(date, game_id)

@app.post("/games/{game_id}/today/start_game")
def start_game_today(game_id: GameId):
    return update_start(today(), game_id)

@app.post("/games/{game_id}/date/{date}/failed_game")
def failed_game(game_id: GameId, date: Date):
    return update_failed(date, game_id)

@app.post("/games/{game_id}/today/failed_game")
def failed_game_today(game_id: GameId):
    return update_failed(today(), game_id)

@app.post("/games/{game_id}/date/{date}/success_game/{attempts}")
def success_game(game_id: GameId, date: Date, attempts: Attempts):
    return update_success(date, game_id, attempts)

@app.post("/games/{game_id}/today/success_game/{attempts}")
def success_game_today(game_id: GameId, attempts: Attempts):
    return update_success(today(), game_id, attempts)

@app.get("/games/{game_id}/date/{date}/stats")
def get_user_stats_endpoint(game_id: GameId, date: Date):
    return get_stats_by_game_and_date(game_id, date)

@app.get("/games/{game_id}/today/stats")
def get_today_game(game_id: GameId):
    return get_stats_by_game_and_date(game_id, today())
