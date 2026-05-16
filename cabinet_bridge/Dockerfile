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
RUN NODE_ENV=development npm install --no-audit --no-fund

ARG CACHE_BUST=67
RUN echo "cache-bust=$CACHE_BUST"

RUN node -e "require('better-sqlite3'); console.log('better-sqlite3 OK');"

COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json drizzle.config.ts ./
COPY shared ./shared
COPY server ./server
COPY client ./client
COPY script ./script

RUN NODE_ENV=production npm run build
RUN npm prune --omit=dev

RUN test -f dist/index.cjs && echo "dist/index.cjs OK" || (echo "ERROR: dist/index.cjs missing!" && exit 1)
RUN test -d dist/public  && echo "dist/public OK"   || (echo "ERROR: dist/public missing!"   && exit 1)

COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 5000
CMD ["/run.sh"]
