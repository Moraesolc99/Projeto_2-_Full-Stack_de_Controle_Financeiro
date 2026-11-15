import { consulta } from '../config/db.js';

export const PADRAO = [
  { nome: 'Salário', tipo: 'entrada', classificacao: null },
  { nome: 'Rendimentos', tipo: 'entrada', classificacao: null },
  { nome: 'Outras entradas', tipo: 'entrada', classificacao: null },
  { nome: 'Moradia', tipo: 'saida', classificacao: 'necessidade' },
  { nome: 'Alimentação', tipo: 'saida', classificacao: 'necessidade' },
  { nome: 'Saúde', tipo: 'saida', classificacao: 'necessidade' },
  { nome: 'Mobilidade', tipo: 'saida', classificacao: 'necessidade' },
  { nome: 'Educação', tipo: 'saida', classificacao: 'necessidade' },
  { nome: 'Lazer', tipo: 'saida', classificacao: 'desejo' },
  { nome: 'Investimentos', tipo: 'saida', classificacao: 'poupanca' },
  { nome: 'Outros', tipo: 'saida', classificacao: 'desejo' },
];

const COLUNAS = 'id, usuario_id AS "usuarioId", nome, tipo, classificacao';

// Todas as consultas filtram por usuario_id: o id vem do token (RF3), nunca do corpo ou da URL.

export async function listar(usuarioId, tipo) {
  const { rows } = await consulta(
    `SELECT ${COLUNAS} FROM categorias
      WHERE usuario_id = $1 AND ($2::text IS NULL OR tipo = $2)
      ORDER BY tipo, nome`,
    [usuarioId, tipo ?? null],
  );
  return rows;
}

export async function buscar(usuarioId, id) {
  const { rows } = await consulta(
    `SELECT ${COLUNAS} FROM categorias WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId],
  );
  return rows[0] ?? null;
}

export async function criar(usuarioId, { nome, tipo, classificacao }) {
  // Nome repetido (ignorando maiúsculas) viola o índice único e vira 409 na rota.
  const { rows } = await consulta(
    `INSERT INTO categorias (usuario_id, nome, tipo, classificacao)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUNAS}`,
    [usuarioId, nome, tipo, classificacao ?? null],
  );
  return rows[0];
}

export async function criarPadrao(usuarioId) {
  for (const categoria of PADRAO) await criar(usuarioId, categoria);
}

export async function atualizar(usuarioId, id, { nome, tipo, classificacao }) {
  const { rows } = await consulta(
    `UPDATE categorias SET nome = $3, tipo = $4, classificacao = $5
      WHERE id = $1 AND usuario_id = $2
      RETURNING ${COLUNAS}`,
    [id, usuarioId, nome, tipo, classificacao ?? null],
  );
  return rows[0] ?? null;
}

export async function contarLancamentos(usuarioId, id) {
  const { rows } = await consulta(
    'SELECT COUNT(*) AS total FROM lancamentos WHERE categoria_id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  return rows[0].total;
}

export async function excluir(usuarioId, id) {
  // Se ainda houver lançamentos, a FK impede a exclusão (erro 23503 → 409 na rota).
  const { rowCount } = await consulta(
    'DELETE FROM categorias WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  return rowCount > 0;
}
