CREATE TABLE results (
    userId UUID NOT NULL,
    gameId VARCHAR(32) NOT NULL,
    started SMALLINT CHECK (started >= 0) NOT NULL DEFAULT 0,
    attempts1 SMALLINT CHECK (attempts1 >= 0) NOT NULL DEFAULT 0,
    attempts2 SMALLINT CHECK (attempts2 >= 0) NOT NULL DEFAULT 0,
    attempts3 SMALLINT CHECK (attempts3 >= 0) NOT NULL DEFAULT 0,
    attempts4 SMALLINT CHECK (attempts4 >= 0) NOT NULL DEFAULT 0,
    attempts5 SMALLINT CHECK (attempts5 >= 0) NOT NULL DEFAULT 0,
    attempts6 SMALLINT CHECK (attempts6 >= 0) NOT NULL DEFAULT 0,
    attempts_plus SMALLINT CHECK (attempts_plus >= 0) NOT NULL DEFAULT 0,
    failures SMALLINT CHECK (failures >= 0) NOT NULL DEFAULT 0,
    PRIMARY KEY (userId, gameId)
);

CREATE INDEX idx_results_userId ON results (gameId);