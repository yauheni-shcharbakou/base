FROM nginx:stable-alpine

COPY ./admin/apps/proxy/nginx.conf.template /etc/nginx/templates/nginx.conf.template

EXPOSE $PORT

CMD /bin/sh -c "envsubst '\$PORT \$ADMIN_AUTH_URL \$ADMIN_MAIN_URL' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"
