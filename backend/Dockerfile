FROM node:22-slim

WORKDIR /app

# Copia só os package*.json primeiro: enquanto as dependências não mudarem,
# o Docker reaproveita essa camada e o build fica rápido.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Ao subir: aplica o schema (idempotente) -> carrega os dados de demonstração só se o banco estiver vazio -> inicia a API.
CMD ["sh", "-c", "npm run db:schema && npm run seed:se-vazio && npm start"]
