# syntax=docker/dockerfile:1

# --- deps: install production dependencies ---
# node:22-slim (glibc, LTS) → bcrypt installs prebuilt binaries with no source compile.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime ---
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Run as the built-in non-root user.
USER node
EXPOSE 4000
# Container-level liveness mirrors the k8s /health probe. Node 20 ships global fetch.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Exec form so node is PID 1 and receives SIGTERM directly (graceful shutdown in src/server.js).
CMD ["node", "src/server.js"]
