FROM nginx:1.29.8

ARG FLAVOUR

RUN rm -f /usr/share/nginx/html/index.html

COPY index.html /usr/share/nginx/html
COPY game.js /usr/share/nginx/html
COPY style.css /usr/share/nginx/html

RUN sed -i "s/PARAM_GAME_TITLE/'$FLAVOUR'/g" /usr/share/nginx/html/game.js