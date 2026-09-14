FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" DISABLE_SCHEDULER=1 npx next build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000

# DATABASE_URL is supplied by the hosting service at runtime.
# Migrate PostgreSQL and seed only an empty database before serving traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/seed-if-empty.js && npm run start"]
