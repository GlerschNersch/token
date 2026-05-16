FROM ghcr.io/home-assistant/amd64-base:latest

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

# Copy all source
COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json drizzle.config.ts ./
COPY shared   ./shared
COPY server   ./server
COPY client   ./client
COPY script   ./script

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
