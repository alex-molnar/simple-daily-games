from fastapi import FastAPI, Response # pyright: ignore[reportMissingImports]

from .db.implementations import save_new_user
from .model import NewUserRequest


app = FastAPI()


def wrap(data, endpoint: str, method: str, response: Response):
    if type(data) == str:
        response.status_code = 500
        return {"error": data, "endpoint": endpoint, "method": method}
    else:
        return data

@app.post("/users/register", status_code=201)
def register_user(data: NewUserRequest, response: Response):
    return wrap(save_new_user(data.gameId), endpoint="/users/register", method="POST", response=response)
