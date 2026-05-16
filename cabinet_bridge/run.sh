#!/usr/bin/with-contenv sh
set -e

# Clear potential background processes from previous failed runs
# (The fatal pid 1 error usually indicates zombie processes or suexec conflicts)

cd /app

export NODE_ENV=production
export PORT=5000
export CABINET_DATA_DIR="${CABINET_DATA_DIR:-/data}"

# Robust extraction of add-on options without complex tools
if [ -f /data/options.json ]; then
  # Simple sed/grep to pull max_upload_mb
  MAX_VAL=$(grep -o '"max_upload_mb": *[0-9]*' /data/options.json | awk -F: '{print $2}' | tr -d ' ')
  if [ ! -z "$MAX_VAL" ]; then
    export CABINET_MAX_UPLOAD_MB="$MAX_VAL"
  fi
fi

export CABINET_MAX_UPLOAD_MB="${CABINET_MAX_UPLOAD_MB:-8192}"

# Ensure data directory exists
mkdir -p "$CABINET_DATA_DIR"

echo "[HomeArcade] Initializing environment..."
echo "[HomeArcade] Architecture: $(uname -m)"
echo "[HomeArcade] Node version: $(node --version)"
echo "[HomeArcade] Max upload: ${CABINET_MAX_UPLOAD_MB}MB"

# Start the application
exec node dist/index.cjs
