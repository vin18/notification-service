FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run prisma:generate

COPY tsconfig.json ./
COPY src ./src
COPY README.md ./
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
