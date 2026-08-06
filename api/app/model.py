from pydantic import BaseModel # pyright: ignore[reportMissingImports]


class NewUserRequest(BaseModel):
    gameId: str

