FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
ENV DATABASE_URL="file:/app/data/dev.db"
RUN npx prisma generate
RUN mkdir -p /app/data
RUN DISABLE_SCHEDULER=1 npx next build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000

# Runs pending migrations against whatever volume is mounted at /app/prisma
# before starting the server, then seeds only if the database is empty.
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/seed-if-empty.js && npm run start"]
