FROM nginx:1.29.8

ARG FLAVOUR

RUN rm -f /usr/share/nginx/html/index.html

RUN mkdir -p /usr/share/nginx/html/src

COPY index.html /usr/share/nginx/html
COPY game.js /usr/share/nginx/html
COPY style /usr/share/nginx/html/style
COPY assets /usr/share/nginx/html/assets

RUN sed -i "s/PARAM_GAME_TITLE/'$FLAVOUR'/g" /usr/share/nginx/html/game.js
