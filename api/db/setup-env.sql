CREATE TABLE results (
    gameId VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    started INTEGER CHECK (started >= 0) NOT NULL DEFAULT 0,
    attempts1 INTEGER CHECK (attempts1 >= 0) NOT NULL DEFAULT 0,
    attempts2 INTEGER CHECK (attempts2 >= 0) NOT NULL DEFAULT 0,
    attempts3 INTEGER CHECK (attempts3 >= 0) NOT NULL DEFAULT 0,
    attempts4 INTEGER CHECK (attempts4 >= 0) NOT NULL DEFAULT 0,
    attempts5 INTEGER CHECK (attempts5 >= 0) NOT NULL DEFAULT 0,
    attempts6 INTEGER CHECK (attempts6 >= 0) NOT NULL DEFAULT 0,
    attempts_plus INTEGER CHECK (attempts_plus >= 0) NOT NULL DEFAULT 0,
    failures INTEGER CHECK (failures >= 0) NOT NULL DEFAULT 0,
    PRIMARY KEY (gameId, date)
);
