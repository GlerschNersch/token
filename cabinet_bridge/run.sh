#!/usr/bin/with-contenv sh
set -e

cd /app

export NODE_ENV=production
export PORT=5000
export CABINET_DATA_DIR="${CABINET_DATA_DIR:-/data}"

mkdir -p "$CABINET_DATA_DIR"

echo "[cabinet_bridge] starting on port $PORT (data dir: $CABINET_DATA_DIR)"
exec node dist/index.cjs
