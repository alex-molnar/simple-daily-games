FROM nginx:1.29.8

RUN rm -f /etc/nginx/conf.d/default.conf /usr/share/nginx/html/index.html

COPY static/nginx.conf /etc/nginx/conf.d/default.conf
COPY static/common.conf /etc/nginx/common.conf

COPY country-games /srv/country-games
COPY flag-games /srv/flag-games
COPY landing /srv/landing
COPY landing/assets /srv/assets/landing
COPY shared /srv/shared
COPY assets /srv/assets
