import { consulta } from '../config/db.js';

export const PADRAO = [
  { nome: 'Conta corrente', tipo: 'conta' },
  { nome: 'Carteira', tipo: 'conta' },
];

const COLUNAS = `id, usuario_id AS "usuarioId", nome, tipo,
  dia_fechamento AS "diaFechamento", dia_vencimento AS "diaVencimento", limite, reserva`;

function normalizar(dados) {
  const cartao = dados.tipo === 'cartao_credito';
  return {
    nome: dados.nome,
    tipo: dados.tipo,
    diaFechamento: cartao ? dados.diaFechamento : null,
    diaVencimento: cartao ? dados.diaVencimento : null,
    limite: cartao ? dados.limite : null,
    reserva: dados.tipo === 'conta' ? Boolean(dados.reserva) : false,
  };
}

export async function listar(usuarioId, tipo) {
  const { rows } = await consulta(
    `SELECT ${COLUNAS} FROM fontes_destinos
      WHERE usuario_id = $1 AND ($2::text IS NULL OR tipo = $2)
      ORDER BY nome`,
    [usuarioId, tipo ?? null],
  );
  return rows;
}

export async function buscar(usuarioId, id) {
  const { rows } = await consulta(
    `SELECT ${COLUNAS} FROM fontes_destinos WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId],
  );
  return rows[0] ?? null;
}

export async function criar(usuarioId, dados) {
  const v = normalizar(dados);
  const { rows } = await consulta(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUNAS}`,
    [usuarioId, v.nome, v.tipo, v.diaFechamento, v.diaVencimento, v.limite, v.reserva],
  );
  return rows[0];
}

export async function criarPadrao(usuarioId) {
  for (const fonte of PADRAO) await criar(usuarioId, fonte);
}

export async function atualizar(usuarioId, id, dados) {
  const v = normalizar(dados);
  const { rows } = await consulta(
    `UPDATE fontes_destinos
        SET nome = $3, tipo = $4, dia_fechamento = $5, dia_vencimento = $6, limite = $7, reserva = $8
      WHERE id = $1 AND usuario_id = $2
      RETURNING ${COLUNAS}`,
    [id, usuarioId, v.nome, v.tipo, v.diaFechamento, v.diaVencimento, v.limite, v.reserva],
  );
  return rows[0] ?? null;
}

export async function contarLancamentos(usuarioId, id) {
  const { rows } = await consulta(
    'SELECT COUNT(*) AS total FROM lancamentos WHERE fonte_destino_id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  return rows[0].total;
}

export async function excluir(usuarioId, id) {
  const { rowCount } = await consulta(
    'DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  return rowCount > 0;
}
