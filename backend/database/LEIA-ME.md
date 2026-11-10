# backend/database

Pasta dos scripts do banco.

- `seed-memoria.js` — dados de demonstração usados enquanto a API roda sem banco (`MODO_BANCO=memoria`). Serve de referência para o seed real.

A ser criado pelo responsável pelo banco (detalhes em `docs/BANCO-DE-DADOS.md`):

- `schema.sql` (ou migrations) — criação das tabelas, chaves, UNIQUE e CHECK
- `seed.sql` ou `seed.js` — 2 usuários e pelo menos 3 meses de lançamentos
