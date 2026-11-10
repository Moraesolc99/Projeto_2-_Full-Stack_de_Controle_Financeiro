# Parte 2 — Front-end (SPA React)

SPA em React + Vite que consome a API da Parte 1.

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:3000/api
npm run dev              # http://localhost:5173
```

A API (pasta `backend/`) precisa estar rodando. Sem ela, as telas mostram o aviso
"Não foi possível falar com o servidor".

Login de demonstração: `ana@email.com` / `senha1234`.

## Estrutura

```
src/
├── main.jsx / App.jsx      entrada e rotas (React Router)
├── index.css               estilos (tema claro e escuro)
├── contexts/
│   └── AuthContext.jsx     usuário, token, login, logout, cadastrar; expiração automática
├── services/
│   ├── api.js              instância única do Axios: injeta o token e trata 401
│   └── financas.js         uma função por rota da API
└── components/
    ├── layout/Layout.jsx   menu lateral, rota protegida e rota pública
    ├── ui/                 campos com máscara, modal, estados (carregando/vazio/erro), filtro de período, formatos
    └── paginas/            Login, Cadastro, Dashboard, Lancamentos (+ FormLancamento), Categorias,
                            FontesDestinos, Relatorios, Faturas, SaudeFinanceira
```

## Telas

| Rota | Tela |
|---|---|
| `/login`, `/cadastro` | acesso (erros do servidor aparecem embaixo do campo certo, ex.: CPF duplicado) |
| `/` | resumo do mês: totais, gastos por categoria, cartões e lançamentos do mês |
| `/lancamentos` | filtros por período, tipo, categoria e fonte; paginação; totais; criar/editar/excluir; parcelamento no cartão; recorrência mensal (criar, mudar os meses seguintes, encerrar) |
| `/faturas` | fatura aberta e próximas por cartão, com cada parcela (ex.: "Notebook 3/10") e o limite |
| `/relatorios` | por categoria (rosca + comparação com período anterior) e por fonte/destino (barras + saldo das contas) |
| `/saude-financeira` | indicadores, projeção de saldo, regra 50/30/20 e dicas |
| `/categorias`, `/fontes-destinos` | cadastros |
