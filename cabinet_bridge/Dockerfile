ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM} AS base

ENV LANG=C.UTF-8 \
    PORT=5000

RUN apk add --no-cache nodejs npm python3 make g++ sqlite-libs

WORKDIR /app

# Install dependencies without running postinstall scripts.
# This avoids esbuild trying to compile/download a native binary for musl/Alpine
# (which can fail or produce an incompatible binary). esbuild falls back to its
# pure-JS implementation automatically, which is fine for a one-off build.
COPY package.json package-lock.json ./
RUN NODE_ENV=development npm install --no-audit --no-fund --ignore-scripts

# Compile better-sqlite3 natively — this IS needed at runtime.
RUN npm rebuild better-sqlite3

# CACHE_BUST: increment to force Docker to re-copy source and rebuild.
# Current: 33
ARG CACHE_BUST=47

# Copy the rest of the source and build.
COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json drizzle.config.ts ./
COPY shared ./shared
COPY server ./server
COPY client ./client
COPY script ./script

RUN NODE_ENV=production npm run build

# Prune dev dependencies after the build to keep the runtime image smaller.
RUN npm prune --omit=dev

# Set production env for runtime.
ENV NODE_ENV=production

COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 5000
CMD ["/run.sh"]
