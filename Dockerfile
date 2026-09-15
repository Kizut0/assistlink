FROM node:22-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS generator

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN npm run generate

FROM base AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY public ./public
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
COPY --from=generator /app/src/generated ./src/generated

USER node
EXPOSE 8081

CMD ["npm", "start"]
