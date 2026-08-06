from pydantic import BaseModel # pyright: ignore[reportMissingImports]


class NewUserRequest(BaseModel):
    gameId: str

class RegisterScoreRequest(BaseModel):
    userId: str
    gameId: str
    attempts: int | None = None
