ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Build arguments provided by the HA builder / GitHub Actions workflow
ARG BUILD_VERSION="dev"
ARG BUILD_ARCH="amd64"

# Required labels for Home Assistant Supervisor to recognise the image
LABEL \
    io.hass.version="${BUILD_VERSION}" \
    io.hass.type="addon" \
    io.hass.arch="${BUILD_ARCH}"

ENV LANG=C.UTF-8 \
    PORT=5000 \
    NODE_ENV=production

# Install Node.js + native build deps for better-sqlite3
RUN apk add --no-cache \
      --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main \
      nodejs npm && \
    apk add --no-cache python3 make g++ sqlite-libs libstdc++ && \
    node --version && npm --version

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN NODE_ENV=development npm install --no-audit --no-fund --ignore-scripts
RUN npm rebuild better-sqlite3

# Cache-bust arg — increment this to force a full source re-copy and rebuild.
# This ensures Docker never serves a stale compiled bundle from a previous layer.
ARG CACHE_BUST=4

# Copy all source (cache busted by ARG above)
COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json drizzle.config.ts ./
COPY shared   ./shared
COPY server   ./server
COPY client   ./client
COPY script   ./script
COPY migrations ./migrations

# Build client (Vite) + server (esbuild -> dist/index.cjs)
RUN NODE_ENV=production npm run build

# Hard-fail the image build if the server bundle is missing
RUN test -f dist/index.cjs || { echo "ERROR: dist/index.cjs not found after build"; exit 1; }

# Prune dev deps to keep the image lean
RUN npm prune --omit=dev

# Install s6-overlay v3 service files
COPY rootfs /
RUN chmod a+x \
      /etc/s6-overlay/s6-rc.d/homearcade/run \
      /etc/s6-overlay/s6-rc.d/homearcade/finish

EXPOSE 5000
ENTRYPOINT ["/init"]
