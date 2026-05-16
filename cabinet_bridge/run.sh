#!/usr/bin/with-contenv sh
set -e

cd /app

export NODE_ENV=production
export PORT=5000
export CABINET_DATA_DIR="${CABINET_DATA_DIR:-/data}"

# Robust extraction of add-on options
if [ -f /data/options.json ]; then
  MAX_VAL=$(grep -o '"max_upload_mb": *[0-9]*' /data/options.json | awk -F: '{print $2}' | tr -d ' ')
  if [ ! -z "$MAX_VAL" ]; then
    export CABINET_MAX_UPLOAD_MB="$MAX_VAL"
  fi
fi

export CABINET_MAX_UPLOAD_MB="${CABINET_MAX_UPLOAD_MB:-8192}"

# Diagnostics
echo "[HomeArcade] Starting boot sequence..."
echo "[HomeArcade] Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"
echo "[HomeArcade] Architecture: $(uname -m)"
echo "[HomeArcade] Data directory: $CABINET_DATA_DIR"

if [ ! -f "dist/index.cjs" ]; then
  echo "[HomeArcade] CRITICAL ERROR: dist/index.cjs not found! Build may have failed."
  exit 1
fi

# Execute the application
exec node dist/index.cjs
