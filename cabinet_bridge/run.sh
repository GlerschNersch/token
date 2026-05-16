#!/usr/bin/with-contenv sh
set -e

cd /app

export NODE_ENV=production
export PORT=5000
export CABINET_DATA_DIR="${CABINET_DATA_DIR:-/data}"

# Pull the user-configurable upload ceiling out of the add-on options when
# bashio is available. Falls back to a generous default for non-HA runs so
# PlayStation-sized archives upload without further tuning.
if command -v bashio >/dev/null 2>&1; then
  if bashio::config.has_value 'max_upload_mb'; then
    CABINET_MAX_UPLOAD_MB="$(bashio::config 'max_upload_mb')"
  fi
fi
export CABINET_MAX_UPLOAD_MB="${CABINET_MAX_UPLOAD_MB:-8192}"

mkdir -p "$CABINET_DATA_DIR"

echo "[cabinet_bridge] starting on port $PORT (data dir: $CABINET_DATA_DIR, max upload: ${CABINET_MAX_UPLOAD_MB}mb)"
exec node dist/index.cjs
