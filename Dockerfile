# CCH Solutions website: static files served by nginx
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html 404.html favicon.svg robots.txt /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
