ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM} AS base

ENV LANG=C.UTF-8 \
    NODE_ENV=production \
    PORT=5000

RUN apk add --no-cache nodejs npm python3 make g++ sqlite-libs

WORKDIR /app

# Install all dependencies (including dev) so we can build the bundle.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Copy the rest of the source and build.
COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json drizzle.config.ts ./
COPY shared ./shared
COPY server ./server
COPY client ./client
COPY script ./script

RUN npm run build

# Prune dev dependencies after the build to keep the runtime image smaller.
RUN npm prune --omit=dev

COPY cabinet_bridge/run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 5000
CMD ["/run.sh"]
