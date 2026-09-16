#!/bin/sh
# nginx runs every script in /docker-entrypoint.d before it starts. This one writes the API URL
# the page reads at runtime, so one image serves every environment.
set -e
: "${API_URL:=http://localhost:3000}"
printf "window.__API_URL__ = '%s';\n" "$API_URL" > /usr/share/nginx/html/env.js
