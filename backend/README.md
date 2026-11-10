# Parte 1 — Back-end (API REST)

API em Node.js + Express com autenticação JWT. Roda sozinha, sem o front e sem banco.

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:3000
npm test           # 12 testes de ponta a ponta
```

Sem banco ligado (`MODO_BANCO=memoria`), os dados de demonstração são carregados ao subir:
`ana@email.com` e `bruno@email.com`, senha `senha1234`.

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
└── config/         env.js, db.js (conexão / armazenamento em memória), erros.js
database/           seed de demonstração e, depois, os scripts do banco
testes/             testes da API (node:test)
```

Lista de rotas, decisões de projeto e regras da saúde financeira: `README.md` da raiz.
