#!/usr/bin/with-contenv bashio

export NODE_ENV=production
export PORT=5000
export CABINET_DATA_DIR="${CABINET_DATA_DIR:-/data}"
export CABINET_MAX_UPLOAD_MB=8192

# Safely read config - bashio::config exits non-zero if key missing, so capture carefully
if bashio::config.exists 'max_upload_mb' 2>/dev/null; then
  _val="$(bashio::config 'max_upload_mb' 2>/dev/null)"
  if [ -n "$_val" ] && [ "$_val" != "null" ] && [ "$_val" != "false" ]; then
    CABINET_MAX_UPLOAD_MB="$_val"
  fi
fi
export CABINET_MAX_UPLOAD_MB

mkdir -p "$CABINET_DATA_DIR"
cd /app

bashio::log.info "HomeArcade starting on port $PORT"
bashio::log.info "Data: $CABINET_DATA_DIR | Max upload: ${CABINET_MAX_UPLOAD_MB}MB"

# Verify better-sqlite3 loads before starting the full app
if ! node -e "require('better-sqlite3'); console.log('sqlite3 ok');" 2>&1; then
  bashio::log.error "FATAL: better-sqlite3 native module failed to load"
  exit 1
fi

bashio::log.info "Launching Node..."
exec node \
  --unhandled-rejections=throw \
  --enable-source-maps \
  dist/index.cjs 2>&1
