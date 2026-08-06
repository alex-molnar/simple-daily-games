from fastapi import FastAPI, Response # pyright: ignore[reportMissingImports]

from .db.implementations import test_connection, save_new_user, update_start, update_failed, update_success


app = FastAPI()


def wrap(data, endpoint: str, method: str, response: Response, status_code: int = 500):
    if type(data) == str:
        response.status_code = status_code
        return {"error": data, "endpoint": endpoint, "method": method}
    else:
        return data


@app.get("/health", status_code=200)
def health_check(response: Response):
    return wrap({'status': 'up'}, endpoint="/health", method="GET", response=response, status_code=200)

@app.get("/readiness", status_code=200)
def readiness_check(response: Response):
    return wrap(test_connection(), endpoint="/readiness", method="GET", response=response, status_code=200)

@app.post("/games/{gameId}/users/register", status_code=201)
def register_user(gameId: str, response: Response):
    return wrap(save_new_user(gameId), endpoint="/games/<gameId>/users/register", method="POST", response=response)

@app.post("/games/{gameId}/users/{userId}/start_game", status_code=200)
def start_game(gameId: str, userId: str, response: Response):
    return wrap(update_start(userId, gameId), endpoint="/games/<gameId>/users/<userId>/start_game", method="POST", response=response)

@app.post("/games/{gameId}/users/{userId}/failed_game", status_code=200)
def failed_game(gameId: str, userId: str, response: Response):
    return wrap(update_failed(userId, gameId), endpoint="/games/<gameId>/users/<userId>/failed_game", method="POST", response=response)

@app.post("/games/{gameId}/users/{userId}/success_game/{attempts}", status_code=200)
def success_game(gameId: str, userId: str, attempts: int, response: Response = None):
    return (
        wrap(update_success(userId, gameId, attempts), endpoint="/games/<gameId>/users/<userId>/success_game/<attempts>", method="POST", response=response)
        if attempts > 0
        else wrap("Attempts must be greater than 0 for success_game endpoint", endpoint="/games/<gameId>/users/<userId>/success_game/<attempts>", method="POST", response=response, status_code=400)
    )
