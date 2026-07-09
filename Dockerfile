FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# Servido em overclock.sh/game — copia em / e /game pra funcionar com ou sem strip de prefixo no proxy.
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/dist /usr/share/nginx/html/game
