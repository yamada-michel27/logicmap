#!/bin/sh
set -e

# Resolve API_BASE_URL (default to localhost for safety)
: "${API_BASE_URL:=http://localhost:8080}"
export API_BASE_URL

# Render runtime config for the client
if [ -f /app/public/config.template.json ]; then
  envsubst < /app/public/config.template.json > /app/public/config.json
fi

exec node server.js
