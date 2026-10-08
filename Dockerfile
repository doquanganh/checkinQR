# ---- build: install deps (better-sqlite3 is native) and bundle the frontend ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
# toolchain only used if better-sqlite3 has no prebuilt binary for the platform
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/checkin.db \
    TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json server.ts tsconfig.json ./
COPY server ./server
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# node (not npm) is PID 1 so SIGTERM reaches the app and SQLite closes cleanly
CMD ["node", "--import", "tsx", "server.ts"]
