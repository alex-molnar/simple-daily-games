-- Run once against an existing database. The API works before and after this runs.
ALTER TABLE results ALTER COLUMN date TYPE DATE USING date::date;
