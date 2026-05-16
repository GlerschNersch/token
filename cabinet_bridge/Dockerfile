ARG BUILD_FROM
FROM ${BUILD_FROM}

ENV LANG=C.UTF-8 \
    PORT=5000 \
    NODE_ENV=production

RUN apk add --no-cache \
      --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main \
      nodejs npm && \
    apk add --no-cache python3 make g++ sqlite-libs libstdc++ && \
    node --version && npm --version

WORKDIR /app

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm install --no-audit --no-fund --ignore-scripts
RUN npm rebuild better-sqlite3

ARG CACHE_BUST=72
RUN echo "cache-bust=$CACHE_BUST"

COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json drizzle.config.ts ./
COPY shared ./shared
COPY server ./server
COPY client ./client
COPY script ./script

RUN NODE_ENV=production npm run build
RUN npm prune --omit=dev

COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 5000
CMD ["/run.sh"]
