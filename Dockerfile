FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime: Node serve o estático (com ou sem prefixo /game) + WebSocket multiplayer em /game/ws.
FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
ENV PORT=80
EXPOSE 80
CMD ["node", "server/server.mjs"]
