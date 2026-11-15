# backend/database

Scripts do banco (PostgreSQL).

- `schema.sql` — DDL: tabelas, chaves estrangeiras, UNIQUE, CHECK e índices. Idempotente (`IF NOT EXISTS`).
- `aplicar-schema.js` — aplica o `schema.sql` no banco de `DATABASE_URL` (`npm run db:schema`).
- `seed.js` — dados de demonstração (2 usuários, 4 meses de lançamentos, parcelas e recorrências). Usa os próprios models, então passa pelas mesmas regras da API.
  - `npm run seed` — falha se já houver usuários
  - `npm run seed:se-vazio` — carrega só se o banco estiver vazio (é o que o Docker usa)
  - `npm run seed:reset` — apaga tudo e recarrega

As datas do seed são relativas a hoje (sempre há lançamentos nos meses recentes e faturas futuras).
