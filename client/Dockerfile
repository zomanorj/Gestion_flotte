# Étape 1 : build de l'application React (Vite)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# API et Socket.io sur la même origine (relayés par nginx) : VITE_API_URL / VITE_SOCKET_URL non définis
RUN npm run build

# Étape 2 : fichiers statiques servis par nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
