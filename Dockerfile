FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache libstdc++
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY package.json server.js db.js ./
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
