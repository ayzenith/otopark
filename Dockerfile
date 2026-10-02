# ---------------------------------------------------------------------------
# Londra Camping Otopark - uretim imaji
# Cok asamali derleme: son imaj yalnizca calistirmak icin gerekenleri tasir.
# ---------------------------------------------------------------------------

FROM node:22-slim AS base
# Prisma'nin ihtiyac duydugu OpenSSL
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Bagimliliklar ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

# --- Derleme ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Derleme sirasinda veritabanina baglanilmaz; yer tutucu yeterli.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Calistirma ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Uygulama root olarak calismaz.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Migration'lar kapsayici baslarken uygulanir, sonra uygulama baslar.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
