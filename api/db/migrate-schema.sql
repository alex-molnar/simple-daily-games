-- Run once against an existing database. The API works before and after this runs.
BEGIN;
ALTER TABLE results ALTER COLUMN date TYPE DATE USING date::date;
ALTER TABLE results
    ALTER COLUMN started TYPE INTEGER,
    ALTER COLUMN attempts1 TYPE INTEGER,
    ALTER COLUMN attempts2 TYPE INTEGER,
    ALTER COLUMN attempts3 TYPE INTEGER,
    ALTER COLUMN attempts4 TYPE INTEGER,
    ALTER COLUMN attempts5 TYPE INTEGER,
    ALTER COLUMN attempts6 TYPE INTEGER,
    ALTER COLUMN attempts_plus TYPE INTEGER,
    ALTER COLUMN failures TYPE INTEGER;
COMMIT;
