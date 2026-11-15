import { consulta } from '../config/db.js';

// Os relatórios são agregações feitas pelo próprio banco (GROUP BY + SUM),
// não somas em JavaScript sobre uma lista com todos os lançamentos.

export async function somarPorCategoria(usuarioId, tipo, inicio, fim) {
  const { rows } = await consulta(
    `SELECT c.id, c.nome, c.classificacao, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1 AND l.tipo = $2 AND l.data BETWEEN $3 AND $4
      GROUP BY c.id, c.nome, c.classificacao
      ORDER BY total DESC, c.nome`,
    [usuarioId, tipo, inicio, fim],
  );
  return rows;
}

// LEFT JOIN: fontes/destinos sem movimento no período também aparecem (com 0).
export async function somarPorFonteDestino(usuarioId, inicio, fim) {
  const { rows } = await consulta(
    `SELECT f.id, f.nome, f.tipo,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0)   AS saidas
       FROM fontes_destinos f
       LEFT JOIN lancamentos l
              ON l.fonte_destino_id = f.id AND l.usuario_id = f.usuario_id
             AND l.data BETWEEN $2 AND $3
      WHERE f.usuario_id = $1
      GROUP BY f.id, f.nome, f.tipo
      ORDER BY f.id`,
    [usuarioId, inicio, fim],
  );
  return rows;
}

export async function totaisPorMes(usuarioId, inicio, fim, { parcelados } = {}) {
  const parametros = [usuarioId, inicio, fim];
  let filtroParcelas = '';
  if (parcelados !== undefined) {
    parametros.push(parcelados);
    filtroParcelas = ' AND (l.total_parcelas > 1) = $4';
  }
  const { rows } = await consulta(
    `SELECT TO_CHAR(l.data, 'YYYY-MM') AS mes,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0)   AS saidas
       FROM lancamentos l
      WHERE l.usuario_id = $1 AND l.data BETWEEN $2 AND $3${filtroParcelas}
      GROUP BY mes
      ORDER BY mes`,
    parametros,
  );
  return rows;
}

export async function saldoAcumulado(usuarioId, fonteDestinoIds, ate) {
  const { rows } = await consulta(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0) AS saldo
       FROM lancamentos
      WHERE usuario_id = $1 AND fonte_destino_id = ANY($2::int[]) AND data <= $3`,
    [usuarioId, fonteDestinoIds, ate],
  );
  return rows[0].saldo;
}
