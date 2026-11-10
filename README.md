# Caderneta — Controle financeiro pessoal (Projeto 2)

Aplicação full stack de controle financeiro. Esta etapa entrega a **API REST** em **Node.js + Express**, com autenticação **JWT**. A interface em React chega na próxima etapa (pasta `frontend/`).

## Integrantes

| Nome | RA | Responsável por |
|---|---|---|
| OCTAVIO LUIS CONEJO DE MORAES | 2268108 | Back-end (API) |
| YURI GARCIA YOSHIDA | 1835807 | Front-end (SPA React) |
| GLEISSON SANTOS VIEIRA | 2525798 | Banco de Dados |

## Apresentação

▶️ **Vídeo no YouTube:** [assistir à apresentação](COLE_AQUI_O_LINK_DO_YOUTUBE)

```
projeto2-financas/
├── backend/     API REST (Express, JWT, bcrypt)
└── docs/        BANCO-DE-DADOS.md — especificação do banco
```

## Tecnologias

| Camada | Bibliotecas |
|---|---|
| Back-end | Node.js 20+, Express 5, jsonwebtoken, bcrypt, cors, dotenv, express-rate-limit |
| Banco | _a definir pelo grupo_ (ver `docs/BANCO-DE-DADOS.md`) |

## Como rodar

Pré-requisito: Node.js 20 ou superior.

```bash
cd backend
npm install
cp .env.example .env          # no Windows: copy .env.example .env
npm run dev                    # API em http://localhost:3000
```

Enquanto o banco não estiver ligado, a API roda com `MODO_BANCO=memoria`: os dados de demonstração são recriados a cada vez que ela sobe, e quem estava logado precisa entrar de novo.

Usuários de demonstração (senha `senha1234`):
- `ana@email.com` — 3 meses de lançamentos, dois cartões, compras parceladas e assinaturas mensais
- `bruno@email.com` — usado para testar o isolamento entre usuários

Testes automáticos (12 testes de ponta a ponta; sobem o servidor numa porta separada):

```bash
npm test
```

Teste rápido sem interface (Postman, Insomnia ou curl):

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@email.com","senha":"senha1234"}'
```

Use o `token` da resposta no cabeçalho `Authorization: Bearer <token>` das outras rotas.

### Banco de dados

_Seção a ser completada pelo responsável pelo banco: como criar o banco, rodar o schema e o seed, e configurar `DATABASE_URL` no `.env`. Depois disso, `MODO_BANCO=banco`._

## Variáveis de ambiente (backend/.env)

| Variável | Para quê |
|---|---|
| `PORT` | Porta da API (padrão 3000) |
| `FRONTEND_URL` | Origem liberada no CORS (padrão `http://localhost:5173`) |
| `JWT_SECRET` | Segredo de assinatura do token. Obrigatório com banco real |
| `JWT_EXPIRA_EM` | Validade do token (padrão `1h`) |
| `LOGIN_MAX_TENTATIVAS` | Tentativas de login por IP a cada 15 min (padrão 10) |
| `MODO_BANCO` | `memoria` ou `banco` |
| `DATABASE_URL` | Conexão com o banco |

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

**Organização.** `backend/src/` tem só `server.js` e as quatro pastas pedidas. Os controladores ficam nos arquivos de `routes/`; o acesso a dados fica só em `models/`; erros passam pelo middleware central `middlewares/erros.js`.

**Funções puras em `models/`.** `cpfValido`, `calcularFatura`, `dividirEmParcelas` e os utilitários de data ficam em `models/regras.js`, porque são regras de negócio. `models/saude.js` calcula os indicadores da saúde financeira usando os outros models.

**Rotas independentes do banco.** Os erros de UNIQUE e de chave estrangeira são identificados em `config/erros.js` para PostgreSQL, MySQL e MongoDB. Trocar o banco não exige mexer nas rotas.

**Dinheiro em centavos.** Toda soma e divisão é feita em centavos inteiros e convertida de volta no final, para não errar arredondamento (`0.1 + 0.2 !== 0.3`).

**Parcelas.** Cada parcela é um lançamento. A `data` de cada uma avança um mês (assim os relatórios mensais mostram o peso real no mês) e todas guardam a `dataCompra`, usada no cálculo da fatura com a regra de fechamento do enunciado: `calcularFatura(dataCompra, cartao, parcelaAtual)`. A sobra dos centavos vai para a primeira parcela.

**Recorrência mensal (além do enunciado).** Para assinaturas e contas fixas: o valor cheio se repete todo mês, do mês da data até o mês final escolhido (máx. 60 meses). Cada mês é um lançamento com a própria data e o mesmo `grupoRecorrencia`, então entra sozinho nas faturas, nos relatórios e na projeção. Dá para mudar o valor dali para frente e encerrar a qualquer momento: os meses anteriores ficam.

**Regras de fonte/destino.** Entrada vem de uma renda ou conta; saída sai de uma conta ou cartão. Só saídas no cartão podem ser parceladas. Não é possível mudar o tipo de uma categoria ou fonte que já tem lançamentos.

**Limite do cartão.** O limite utilizado soma tudo o que já foi comprado e cuja fatura ainda não venceu (inclusive a fatura fechada aguardando pagamento). Parcelas futuras de uma compra entram; mensalidades futuras de uma recorrência não, até serem cobradas.

**Segurança.** Senha com bcrypt (custo 10); o hash nunca sai da API. Login com mensagem genérica e tempo igual para e-mail inexistente. Rate limit no login. CORS restrito à origem do front. Toda entrada é validada e limpa no servidor. O id do usuário vem sempre do token, e registros de outro usuário respondem 404.

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

A resposta da rota traz o aviso de que as informações são educativas e não constituem recomendação financeira profissional.
