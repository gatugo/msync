# MindSync — production image (Next.js standalone output)
# Multi-stage: deps -> build -> slim runtime

FROM node:24-alpine AS base

# ---- deps: full install (incl. dev) for building ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# PWA service worker (public/sw.js) is generated here; sharp/unrs install scripts run in `npm ci`
RUN npm run build

# ---- runner: standalone server only ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# next standalone runs as a non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# public/ (incl. the PWA service worker) must be copied explicitly
COPY --from=builder /app/public ./public
# standalone bundle includes its pruned node_modules + server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
