from fastapi import FastAPI, Response # pyright: ignore[reportMissingImports]

from .db.implementations import save_new_user, update_start, update_failed, update_success
from .model import NewUserRequest, RegisterScoreRequest


app = FastAPI()


def wrap(data, endpoint: str, method: str, response: Response, status_code: int = 500):
    if type(data) == str:
        response.status_code = status_code
        return {"error": data, "endpoint": endpoint, "method": method}
    else:
        return data

@app.post("/users/register", status_code=201)
def register_user(data: NewUserRequest, response: Response):
    return wrap(save_new_user(data.gameId), endpoint="/users/register", method="POST", response=response)

@app.put("/users/start_game", status_code=200)
def start_game(data: RegisterScoreRequest, response: Response):
    return wrap(update_start(data.userId, data.gameId), endpoint="/users/start_game", method="PUT", response=response)

@app.put("/users/failed_game", status_code=200)
def failed_game(data: RegisterScoreRequest, response: Response):
    return wrap(update_failed(data.userId, data.gameId), endpoint="/users/failed_game", method="PUT", response=response)

@app.put("/users/success_game", status_code=200)
def success_game(data: RegisterScoreRequest, response: Response):
    return (
        wrap(update_success(data.userId, data.gameId, data.attempts), endpoint="/users/success_game", method="PUT", response=response)
        if data.attempts is not None and data.attempts > 0
        else wrap("Attempts must be provided and greater than 0 for success_game endpoint", endpoint="/users/success_game", method="PUT", response=response, status_code=400)
    )