# Discord bot image.
# `npm run deploy` runs as: docker run --rm --env-file .env <image> node src/deploy-commands.js
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
USER node

CMD ["node", "src/index.js"]
