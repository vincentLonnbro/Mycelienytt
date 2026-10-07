FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]