from datetime import date as Date, datetime, timezone
from fastapi import FastAPI, Header, Path, Request # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from fastapi.responses import JSONResponse, Response # pyright: ignore[reportMissingImports]
from logging import basicConfig, getLogger, INFO
from os import getenv
from typing import Annotated, Literal, get_args

from psycopg2 import Error as DatabaseError # pyright: ignore[reportMissingModuleSource, reportMissingImports]

from .db.implementations import test_connection, update_start, update_failed, update_success, get_stats_by_game_and_date
from .metrics import DB_UP, GAME_FAILED, GAME_STARTED, GAME_WON, PAGE_VIEWS, attempts_label, classify_user_agent, init_game_series, lifespan, metrics_middleware


app = FastAPI(lifespan=lifespan)

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=getenv("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_credentials=getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true",
    allow_methods=getenv("CORS_ALLOW_METHODS", "*").split(","),
    allow_headers=getenv("CORS_ALLOW_HEADERS", "*").split(","),
)
app.middleware("http")(metrics_middleware)

log = getLogger(__name__)

basicConfig(
    level=getenv("LOG_LEVEL", INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

# Rows are created on first write, so this is what stops anyone from creating rows for any name.
GameId = Literal["capitale", "countryle", "grayscale", "invertedle", "geo-fun-factle"]
Attempts = Annotated[int, Path(ge=1)]
# Page views also come from the landing page, which is not a game, so it is not a GameId and cannot get result rows.
PageId = Literal[GameId, "landing"]
init_game_series(get_args(GameId))


@app.exception_handler(DatabaseError)
def database_error(request: Request, exc: DatabaseError):
    log.error(f'Database error on {request.method} {request.url.path}: {exc}')
    DB_UP.set(0)
    return JSONResponse({"detail": "Database unavailable"}, status_code=503)

def today() -> Date:
    # UTC, to match the client, which builds its date from toISOString()
    return datetime.now(timezone.utc).date()


@app.get("/health")
def health_check():
    return {'status': 'up'}

@app.get("/readiness")
def readiness_check():
    result = test_connection()
    DB_UP.set(1)
    return result

@app.post("/games/{game_id}/today/start_game")
def start_game_today(game_id: GameId):
    result = update_start(today(), game_id)
    GAME_STARTED.labels(game_id).inc()
    return result

@app.post("/games/{game_id}/today/failed_game")
def failed_game_today(game_id: GameId):
    result = update_failed(today(), game_id)
    GAME_FAILED.labels(game_id).inc()
    return result

@app.post("/games/{game_id}/today/success_game/{attempts}")
def success_game_today(game_id: GameId, attempts: Attempts):
    result = update_success(today(), game_id, attempts)
    GAME_WON.labels(game_id, attempts_label(attempts)).inc()
    return result

@app.post("/games/{page_id}/today/visit", status_code=204)
def visit_today(page_id: PageId, user_agent: Annotated[str, Header()] = ""):
    PAGE_VIEWS.labels(page_id, *classify_user_agent(user_agent)).inc()
    return Response(status_code=204)

@app.get("/games/{game_id}/today/stats")
def get_today_game(game_id: GameId):
    return get_stats_by_game_and_date(game_id, today())
