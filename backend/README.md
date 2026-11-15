# Parte 1 — Back-end (API REST)

API em Node.js + Express com autenticação JWT. Roda sozinha, sem o front.

Precisa de um PostgreSQL (o jeito mais simples é `docker compose up -d db`, na raiz do projeto).

```bash
npm install
cp .env.example .env
npm run db:schema  # cria as tabelas
npm run seed       # dados de demonstração
npm run dev        # http://localhost:3000
npm test           # 12 testes de ponta a ponta (usam o banco <nome>_teste)
```

Dados de demonstração: `ana@email.com` e `bruno@email.com`, senha `senha1234`.

Teste rápido sem o front:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@email.com","senha":"senha1234"}'
```

## Estrutura

```
src/
├── server.js       app Express, middlewares e rotas
├── routes/         rotas + controladores (auth, categorias, fontesDestinos, lancamentos, relatorios, saude)
├── models/         acesso a dados (*.model.js) e regras de negócio (regras.js, saude.js)
├── middlewares/    autenticar.js (JWT), validar.js (validação e sanitização), erros.js
└── config/         env.js, db.js (pool, consulta(), transacao()), erros.js
database/           schema.sql, seed.js e aplicar-schema.js
testes/             testes da API (node:test)
```

Lista de rotas, decisões de projeto e regras da saúde financeira: `README.md` da raiz.
