import { randomUUID } from 'node:crypto';
import { consulta } from '../config/db.js';

// Lançamento já com o nome da categoria e da fonte/destino (JOIN), no formato que a API devolve.
const SELECT_BASE = `
  SELECT l.id, l.usuario_id AS "usuarioId", l.tipo, l.descricao, l.valor,
         l.data, l.data_compra AS "dataCompra",
         l.categoria_id AS "categoriaId", l.fonte_destino_id AS "fonteDestinoId",
         l.parcela_atual AS "parcelaAtual", l.total_parcelas AS "totalParcelas",
         l.grupo_parcelamento AS "grupoParcelamento", l.grupo_recorrencia AS "grupoRecorrencia",
         l.criado_em AS "criadoEm",
         c.nome AS "categoriaNome", f.nome AS "fonteDestinoNome", f.tipo AS "fonteDestinoTipo"
    FROM lancamentos l
    JOIN categorias      c ON c.id = l.categoria_id
    JOIN fontes_destinos f ON f.id = l.fonte_destino_id`;

// Campos que podem ser alterados -> coluna. Os nomes das colunas vêm SEMPRE desta lista,
// nunca do que o usuário enviou: assim o SET dinâmico não abre brecha para SQL injection.
const COLUNAS_EDITAVEIS = {
  tipo: 'tipo',
  descricao: 'descricao',
  valor: 'valor',
  data: 'data',
  dataCompra: 'data_compra',
  categoriaId: 'categoria_id',
  fonteDestinoId: 'fonte_destino_id',
};

function montarFiltros(usuarioId, { inicio, fim, tipo, categoriaId, fonteDestinoId }) {
  const condicoes = ['l.usuario_id = $1'];
  const parametros = [usuarioId];
  const adicionar = (condicao, valor) => {
    parametros.push(valor);
    condicoes.push(condicao.replace('?', `$${parametros.length}`));
  };
  if (inicio) adicionar('l.data >= ?', inicio);
  if (fim) adicionar('l.data <= ?', fim);
  if (tipo) adicionar('l.tipo = ?', tipo);
  if (categoriaId) adicionar('l.categoria_id = ?', categoriaId);
  if (fonteDestinoId) adicionar('l.fonte_destino_id = ?', fonteDestinoId);
  return { where: condicoes.join(' AND '), parametros };
}

function montarSet(campos) {
  const colunas = Object.keys(campos).filter((k) => k in COLUNAS_EDITAVEIS);
  return {
    set: colunas.map((k, i) => `${COLUNAS_EDITAVEIS[k]} = $${i + 1}`).join(', '),
    valores: colunas.map((k) => campos[k]),
  };
}

export async function listar(usuarioId, filtros, { pagina = 1, porPagina = 20 } = {}) {
  const { where, parametros } = montarFiltros(usuarioId, filtros);
  const [itens, total] = await Promise.all([
    consulta(
      `${SELECT_BASE} WHERE ${where}
        ORDER BY l.data DESC, l.id DESC
        LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, porPagina, (pagina - 1) * porPagina],
    ),
    consulta(`SELECT COUNT(*) AS total FROM lancamentos l WHERE ${where}`, parametros),
  ]);
  return { itens: itens.rows, total: total.rows[0].total };
}

// Totais calculados no banco (SUM), não somando uma lista no JavaScript.
export async function totais(usuarioId, filtros) {
  const { where, parametros } = montarFiltros(usuarioId, filtros);
  const { rows } = await consulta(
    `SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0)   AS saidas
       FROM lancamentos l WHERE ${where}`,
    parametros,
  );
  return rows[0];
}

export async function buscar(usuarioId, id) {
  const { rows } = await consulta(`${SELECT_BASE} WHERE l.id = $1 AND l.usuario_id = $2`, [id, usuarioId]);
  return rows[0] ?? null;
}

export async function listarGrupo(usuarioId, grupo) {
  const { rows } = await consulta(
    `${SELECT_BASE} WHERE l.grupo_parcelamento = $1 AND l.usuario_id = $2 ORDER BY l.parcela_atual`,
    [grupo, usuarioId],
  );
  return rows;
}

// Uma linha por parcela (ou por mês, na recorrência). A rota chama isto dentro de transacao():
// se qualquer INSERT falhar, nenhuma parcela fica gravada.
export async function criar(usuarioId, base, ocorrencias, { recorrente = false } = {}) {
  const parcelado = !recorrente && ocorrencias.length > 1;
  const grupoParcelamento = parcelado ? randomUUID() : null;
  const grupoRecorrencia = recorrente ? randomUUID() : null;

  const ids = [];
  for (const [i, ocorrencia] of ocorrencias.entries()) {
    const { rows } = await consulta(
      `INSERT INTO lancamentos
         (usuario_id, tipo, descricao, valor, data, data_compra, categoria_id, fonte_destino_id,
          parcela_atual, total_parcelas, grupo_parcelamento, grupo_recorrencia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        usuarioId, base.tipo, base.descricao, ocorrencia.valor, ocorrencia.data,
        recorrente ? ocorrencia.data : base.data,
        base.categoriaId, base.fonteDestinoId,
        parcelado ? i + 1 : 1, parcelado ? ocorrencias.length : 1,
        grupoParcelamento, grupoRecorrencia,
      ],
    );
    ids.push(rows[0].id);
  }

  const { rows } = await consulta(`${SELECT_BASE} WHERE l.id = ANY($1::int[]) ORDER BY l.id`, [ids]);
  return rows;
}

export async function atualizar(usuarioId, id, campos) {
  const { set, valores } = montarSet(campos);
  if (!set) return buscar(usuarioId, id);
  const { rowCount } = await consulta(
    `UPDATE lancamentos SET ${set} WHERE id = $${valores.length + 1} AND usuario_id = $${valores.length + 2}`,
    [...valores, id, usuarioId],
  );
  return rowCount ? buscar(usuarioId, id) : null;
}

export async function excluir(usuarioId, id) {
  const { rowCount } = await consulta('DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rowCount;
}

export async function excluirGrupo(usuarioId, grupo) {
  const { rowCount } = await consulta(
    'DELETE FROM lancamentos WHERE grupo_parcelamento = $1 AND usuario_id = $2',
    [grupo, usuarioId],
  );
  return rowCount;
}

export async function atualizarRecorrencia(usuarioId, grupo, aPartirDe, campos) {
  const { set, valores } = montarSet(campos);
  if (!set) return 0;
  const n = valores.length;
  const { rowCount } = await consulta(
    `UPDATE lancamentos SET ${set}
      WHERE grupo_recorrencia = $${n + 1} AND usuario_id = $${n + 2} AND data >= $${n + 3}`,
    [...valores, grupo, usuarioId, aPartirDe],
  );
  return rowCount;
}

// Sem `aPartirDe`, apaga todos os meses da recorrência.
export async function excluirRecorrencia(usuarioId, grupo, aPartirDe) {
  const parametros = [grupo, usuarioId];
  let filtroData = '';
  if (aPartirDe) {
    parametros.push(aPartirDe);
    filtroData = ' AND data >= $3';
  }
  const { rowCount } = await consulta(
    `DELETE FROM lancamentos WHERE grupo_recorrencia = $1 AND usuario_id = $2${filtroData}`,
    parametros,
  );
  return rowCount;
}

export async function listarDoCartao(usuarioId, cartaoId) {
  const { rows } = await consulta(
    `${SELECT_BASE} WHERE l.usuario_id = $1 AND l.fonte_destino_id = $2 AND l.tipo = 'saida'`,
    [usuarioId, cartaoId],
  );
  return rows;
}
