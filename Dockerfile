FROM node:22-alpine AS base
# Зеркало Alpine для Timeweb (dl-cdn часто зависает)
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirror.yandex.ru/mirrors|g' /etc/apk/repositories \
  && apk add --no-cache libc6-compat openssl su-exec
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config set registry "${NPM_REGISTRY}" \
  && npm config set fetch-timeout 600000 \
  && npm config set fetch-retries 5
RUN --mount=type=cache,target=/root/.npm \
  npm ci --no-audit --no-fund --progress=false

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p public
RUN npx prisma generate
RUN npm run build

# ─── Production runner ────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema + CLI for db push/seed on startup
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
RUN --mount=type=cache,target=/root/.npm \
  npm install prisma@6.8.0 tsx bcryptjs --omit=dev --no-audit --no-fund --progress=false \
  && chown -R nextjs:nodejs /app

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Entrypoint runs as root to fix uploads volume permissions, then drops to nextjs.
ENTRYPOINT ["/entrypoint.sh"]
