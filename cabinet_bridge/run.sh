#!/usr/bin/with-contenv bashio
set -e

cd /app

export NODE_ENV=production
export PORT=5000
export CABINET_DATA_DIR="${CABINET_DATA_DIR:-/data}"

# Pull the user-configurable upload ceiling out of the add-on options.
# Falls back to a generous default so large archives upload without further tuning.
if bashio::config.has_value 'max_upload_mb'; then
  export CABINET_MAX_UPLOAD_MB="$(bashio::config 'max_upload_mb')"
else
  export CABINET_MAX_UPLOAD_MB=8192
fi

mkdir -p "$CABINET_DATA_DIR"

bashio::log.info "starting on port $PORT (data dir: $CABINET_DATA_DIR, max upload: ${CABINET_MAX_UPLOAD_MB}mb)"
exec node dist/index.cjs
