# Caderneta — Controle financeiro pessoal (Projeto 2)

Aplicação full stack de controle financeiro: API REST em **Node.js + Express** com autenticação **JWT** e uma SPA em **React (Vite)**.

## Integrantes

| Nome | RA | Responsável por |
|---|---|---|
| OCTAVIO LUIS CONEJO DE MORAES | 2268108 | Front-end (SPA React) |
| YURI GARCIA YOSHIDA | 1835807 |  Back-end (API) |
| GLEISSON SANTOS VIEIRA | 2525798 | Banco de Dados |

## Apresentação

▶️ **Vídeo no YouTube:** [assistir à apresentação](https://youtu.be/mGZJk3YLC9I)

```
Projeto_2-_Full-Stack_de_Controle_Financeiro/
├── docker-compose.yml   sobe banco + API + front com um comando
├── backend/             API REST (Express, JWT, bcrypt, pg)
│   └── database/        schema.sql, seed.js, aplicar-schema.js
├── frontend/            SPA React (React Router, Axios, Recharts)
└── docs/                BANCO-DE-DADOS.md — modelo e decisões do banco
```

## Tecnologias

| Camada | Bibliotecas |
|---|---|
| Back-end | Node.js 20+, Express 5, jsonwebtoken, bcrypt, cors, dotenv, express-rate-limit |
| Front-end | React 18, Vite 6, React Router 6, Axios, Recharts |
| Banco | PostgreSQL 16 (driver `pg`, com pool de conexões) |
| Infra | Docker + Docker Compose |

## Como rodar

### Opção A — Docker (recomendada: um comando)

Pré-requisito: Docker com Compose v2.

```bash
docker compose up --build
```

Na primeira vez isso: baixa o PostgreSQL, cria o banco, aplica o `schema.sql`, carrega os dados de demonstração e sobe a API e o front.

| Serviço | Endereço |
|---|---|
| Front-end | http://localhost:5173 |
| API | http://localhost:3000/api/status |
| PostgreSQL | `localhost:5432` (usuário, senha e banco: `financas`) |

Login de demonstração (senha `senha1234`):
- `ana@email.com` — 4 meses de lançamentos, dois cartões, compras parceladas e recorrências
- `bruno@email.com` — usado para testar o isolamento entre usuários

Comandos úteis:

```bash
docker compose up --build -d          # sobe em segundo plano
docker compose logs -f backend        # acompanha a API
docker compose exec backend npm run seed:reset   # recarrega os dados de demonstração
docker compose exec backend npm test             # 12 testes de ponta a ponta (usam um banco separado, financas_teste)
docker compose exec db psql -U financas          # abre o console SQL
```

#### Encerrar os serviços

Quando terminar de usar o projeto, execute na raiz do repositório:

```bash
docker compose down
```

Esse comando encerra e remove os containers e a rede do Compose, mas **preserva o volume `caderneta_pgdata` e os dados do PostgreSQL**. Para iniciar novamente, use `docker compose up -d`.

> **Atenção:** não use `docker compose down -v` para um encerramento normal. A opção `-v` também remove o volume do banco e apaga os dados persistidos.

Para mudar senha do banco, porta ou segredo do JWT: `cp .env.example .env` e edite (o `.env` não vai para o Git).

### Opção B — Sem Docker para a API e o front

Pré-requisitos: Node.js 20+ e um PostgreSQL 14+ rodando.

```bash
# 1. banco (uma vez)
createdb financas        # ou: docker compose up -d db

# 2. back-end
cd backend
npm install
cp .env.example .env     # ajuste DATABASE_URL se precisar
npm run db:schema        # cria as tabelas
npm run seed             # dados de demonstração
npm run dev              # API em http://localhost:3000

# 3. front-end (outro terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

### Banco de dados

Modelo, restrições e decisões em [`docs/BANCO-DE-DADOS.md`](docs/BANCO-DE-DADOS.md).

| O quê | Onde / comando |
|---|---|
| DDL (tabelas, FKs, UNIQUE, CHECK, índices) | `backend/database/schema.sql` |
| Aplicar o schema (idempotente) | `npm run db:schema` |
| Seed (2 usuários, 4 meses de lançamentos, parcelas e recorrências) | `npm run seed` (`seed:se-vazio` só se o banco estiver vazio; `seed:reset` apaga tudo e recarrega) |
| Conexão e pool | `backend/src/config/db.js` (variável `DATABASE_URL`) |
| Acesso a dados | só em `backend/src/models/*.model.js`, com SQL parametrizado (`$1, $2...`) |

No Docker, o back-end aplica o schema e o seed sozinho ao subir. Os testes (`npm test`) criam e usam um banco separado (`<nome>_teste`), então não mexem nos dados de desenvolvimento.

## Variáveis de ambiente (backend/.env)

| Variável | Para quê |
|---|---|
| `PORT` | Porta da API (padrão 3000) |
| `FRONTEND_URL` | Origem liberada no CORS (padrão `http://localhost:5173`) |
| `JWT_SECRET` | Segredo de assinatura do token. Obrigatório em produção |
| `JWT_EXPIRA_EM` | Validade do token (padrão `1h`) |
| `LOGIN_MAX_TENTATIVAS` | Tentativas de login por IP a cada 15 min (padrão 10) |
| `DATABASE_URL` | Conexão com o PostgreSQL. Ex.: `postgres://financas:financas@localhost:5432/financas` |
| `DB_POOL_MAX` | Máximo de conexões do pool (padrão 10) |
| `NODE_ENV` | Com `production`, a API se recusa a iniciar sem um `JWT_SECRET` de verdade |

O `.env` não vai para o Git (está no `.gitignore`); o `.env.example` vai.

## Rotas da API

Todas abaixo de `/api`. Exceto cadastro e login, exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição | Respostas |
|---|---|---|---|
| POST | `/auth/cadastro` | Cadastra usuário (cria categorias e contas padrão) | 201, 400, 409 |
| POST | `/auth/login` | Devolve o JWT e os dados do usuário | 200, 400, 401, 429 |
| GET | `/auth/me` | Usuário logado | 200, 401, 404 |
| GET / POST | `/categorias` | Lista (`?tipo=`) / cria | 200, 201, 400, 409 |
| PUT / DELETE | `/categorias/:id` | Edita / exclui | 200, 204, 400, 404, 409 |
| GET / POST | `/fontes-destinos` | Lista (`?tipo=`) / cria | 200, 201, 400, 409 |
| PUT / DELETE | `/fontes-destinos/:id` | Edita / exclui | 200, 204, 400, 404, 409 |
| GET | `/lancamentos?inicio=&fim=&tipo=&categoriaId=&fonteDestinoId=&pagina=&porPagina=` | Lista com filtros, paginação e totais (padrão: mês corrente) | 200, 400 |
| POST | `/lancamentos` | Cria lançamento. `parcelas` > 1 no cartão gera uma linha por parcela; `recorrente: true` + `repetirAte: "AAAA-MM"` gera uma linha por mês com o valor cheio | 201, 400, 404 |
| GET / PUT / DELETE | `/lancamentos/:id` | Detalha / edita (`?aplicarSeguintes=true` leva a mudança aos meses seguintes de uma recorrência) / exclui (`?todasParcelas=true`, ou `?recorrencia=seguintes` para encerrar, `?recorrencia=todas` para apagar todos os meses) | 200, 204, 400, 404 |
| GET | `/relatorios/categorias?inicio=&fim=` | Totais por categoria, % e comparação com o período anterior | 200, 400 |
| GET | `/relatorios/fontes-destinos?inicio=&fim=` | Entradas por fonte, saídas por destino e saldo das contas | 200, 400 |
| GET | `/relatorios/faturas?meses=3` | Fatura aberta + próximas de cada cartão, limite usado e disponível | 200, 400 |
| GET | `/saude-financeira` | Indicadores, projeção e dicas | 200 |

Todas as respostas de erro seguem o mesmo formato:

```json
{ "erro": "Dados inválidos.", "campos": { "valor": "O valor deve ser maior que zero." } }
```

## Decisões de projeto

**Organização do back-end.** `src/` tem só `server.js` e as quatro pastas pedidas. Os controladores ficam nos arquivos de `routes/`; o acesso a dados fica só em `models/`; erros passam pelo middleware central `middlewares/erros.js`.

**Funções puras em `models/`.** `cpfValido`, `calcularFatura`, `dividirEmParcelas` e os utilitários de data ficam em `models/regras.js`, porque são regras de negócio. `models/saude.js` calcula os indicadores da saúde financeira usando os outros models.

**Rotas independentes do banco.** Os erros de UNIQUE e de chave estrangeira são identificados em `config/erros.js` para PostgreSQL, MySQL e MongoDB. Trocar o banco não exige mexer nas rotas.

**Dinheiro em centavos.** Toda soma e divisão é feita em centavos inteiros e convertida de volta no final, para não errar arredondamento (`0.1 + 0.2 !== 0.3`).

**Parcelas.** Cada parcela é um lançamento. A `data` de cada uma avança um mês (assim os relatórios mensais mostram o peso real no mês) e todas guardam a `dataCompra`, usada no cálculo da fatura com a regra de fechamento do enunciado: `calcularFatura(dataCompra, cartao, parcelaAtual)`. A sobra dos centavos vai para a primeira parcela.

**Recorrência mensal (além do enunciado).** Para assinaturas e contas fixas: o valor cheio se repete todo mês, do mês da data até o mês final escolhido (máx. 60 meses). Cada mês é um lançamento com a própria data e o mesmo `grupoRecorrencia`, então entra sozinho nas faturas, nos relatórios e na projeção. Dá para mudar o valor dali para frente ("aplicar aos meses seguintes") e encerrar a qualquer momento: os meses anteriores ficam. Mensalidades futuras não ocupam limite do cartão até serem cobradas, diferente de parcelas, que ocupam o limite desde a compra.

**Regras de fonte/destino.** Entrada vem de uma renda ou conta; saída sai de uma conta ou cartão. Só saídas no cartão podem ser parceladas. Não é possível mudar o tipo de uma categoria ou fonte que já tem lançamentos.

**Limite do cartão.** O limite utilizado soma tudo o que já foi comprado e cuja fatura ainda não venceu (inclusive a fatura fechada aguardando pagamento). Parcelas futuras de uma compra entram; mensalidades futuras de uma recorrência não, até serem cobradas.

**Segurança.** Senha com bcrypt (custo 10); o hash nunca sai da API. Login com mensagem genérica e tempo igual para e-mail inexistente. Rate limit no login. CORS restrito à origem do front. Toda entrada é validada e limpa no servidor. O id do usuário vem sempre do token, e registros de outro usuário respondem 404.

**Front-end.** `AuthContext` guarda token e usuário (o token sobrevive ao recarregar, via `localStorage`). `services/api.js` é o único ponto de acesso à API: injeta o token e, ao receber 401, faz logout e volta ao login. A sessão também expira sozinha no horário de expiração do token. Todas as telas tratam carregando, lista vazia e erro, e o layout se adapta ao celular (lançamentos viram cartões e os formulários abrem de baixo para cima).

**Banco de dados.** PostgreSQL com o driver `pg`. A unicidade de e-mail e CPF é garantida por `UNIQUE` no banco (a verificação prévia na rota só serve para dar a mensagem mais cedo); a rota trata o erro `23505` e responde 409. As parcelas são gravadas dentro de uma transação (`transacao()` em `config/db.js`, que guarda a conexão da transação em um `AsyncLocalStorage`, então os models não precisam saber se há transação aberta). Os relatórios usam `GROUP BY`/`SUM` no próprio banco. Lançamentos têm FK composta `(categoria_id, usuario_id)` e `(fonte_destino_id, usuario_id)`, então o banco recusa categoria ou fonte de outro usuário mesmo que a API erre. Detalhes em `docs/BANCO-DE-DADOS.md`.

## Saúde financeira — como as dicas são geradas

Os cálculos ficam em `backend/src/models/saude.js` e usam os 3 meses fechados anteriores ao mês atual. As dicas são regras com estes limites (constante `LIMITES`):

| Indicador | Cálculo | Dica |
|---|---|---|
| Taxa de poupança | (entradas − saídas) ÷ entradas, por mês | alerta se negativa; atenção abaixo de 10%; positiva a partir de 10% (ótimo a partir de 20%) |
| Cartões / renda | soma das 3 próximas faturas ÷ (renda média × 3) | alerta a partir de 30% |
| Parcelas futuras | parcelas com fatura ainda não vencida, por mês | informa total e último mês |
| Regra 50/30/20 | saídas por classificação da categoria ÷ renda; poupança = categoria "poupança" + o que não foi gasto | atenção se necessidades > 50% ou desejos > 30%; positiva se poupança ≥ 20%. Categoria sem classificação conta como desejo |
| Categoria fora da curva | gasto do mês atual na categoria ÷ média dos 3 meses anteriores | atenção a partir de 30% acima, se o gasto for de pelo menos R$ 50 |
| Reserva de emergência | saldo das contas marcadas como reserva ÷ gasto médio mensal | atenção abaixo de 3 meses; positiva de 3 em diante |
| Projeção de saldo (6 meses) | saldo atual + (renda média − gastos à vista médios − parcelas já lançadas no mês) | alerta se ficar negativo |

A página avisa, em texto visível, que as informações são educativas e não constituem recomendação financeira profissional.
