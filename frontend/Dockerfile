FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0: sem isso o Vite só escuta dentro do container e o navegador não consegue acessar.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
