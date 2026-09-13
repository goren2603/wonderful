FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
ENV DATABASE_URL="file:./prisma/dev.db"
RUN npx prisma generate
RUN npx next build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000

# Runs pending migrations against whatever volume is mounted at /app/prisma
# before starting the server, then seeds only if the database is empty.
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/seed-if-empty.js; npm run start"]
