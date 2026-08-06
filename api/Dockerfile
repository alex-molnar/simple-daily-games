
FROM kingbrady/fast-api-base:0.1.0

COPY ./app /code/app
COPY ./db/database.ini /code/db/database.ini

CMD ["fastapi", "run", "app/main.py", "--port", "80"]