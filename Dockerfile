FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Containers must listen on all interfaces to be reachable through published ports.
ENV HOST=0.0.0.0

EXPOSE 5173 3001

CMD ["npx", "concurrently", "npm run server", "npm run client -- --host 0.0.0.0"]
