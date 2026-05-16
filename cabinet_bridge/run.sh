#!/usr/bin/with-contenv bashio
set -e

bashio::log.info "Starting HomeArcade boot sequence..."

cd /app

export NODE_ENV=production
export PORT=5000
export CABINET_DATA_DIR="${CABINET_DATA_DIR:-/data}"

# Use bashio to get the configuration
if bashio::config.has_value 'max_upload_mb'; then
    export CABINET_MAX_UPLOAD_MB=$(bashio::config 'max_upload_mb')
fi

export CABINET_MAX_UPLOAD_MB="${CABINET_MAX_UPLOAD_MB:-8192}"

# Diagnostics
bashio::log.info "Architecture: $(uname -m)"
bashio::log.info "Node version: $(node --version)"
bashio::log.info "Max upload: ${CABINET_MAX_UPLOAD_MB}MB"

if [ ! -f "dist/index.cjs" ]; then
    bashio::log.fatal "dist/index.cjs not found! The build failed to produce the server file."
    exit 1
fi

bashio::log.info "Handing off to Node.js..."
exec node dist/index.cjs
