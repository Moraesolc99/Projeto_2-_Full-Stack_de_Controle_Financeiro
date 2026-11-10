import { randomUUID } from 'node:crypto';
import { memoria, proximoId } from '../config/db.js';
import { somar } from './regras.js';

// Junta os nomes da categoria e da fonte/destino, como faria um JOIN.
function comNomes(l) {
  const categoria = memoria.categorias.find((c) => c.id === l.categoriaId);
  const fonte = memoria.fontes_destinos.find((f) => f.id === l.fonteDestinoId);
  return {
    ...l,
    categoriaNome: categoria?.nome ?? null,
    fonteDestinoNome: fonte?.nome ?? null,
    fonteDestinoTipo: fonte?.tipo ?? null,
  };
}

function filtrar(usuarioId, { inicio, fim, tipo, categoriaId, fonteDestinoId }) {
  return memoria.lancamentos.filter((l) => l.usuarioId === usuarioId
    && (!inicio || l.data >= inicio)
    && (!fim || l.data <= fim)
    && (!tipo || l.tipo === tipo)
    && (!categoriaId || l.categoriaId === categoriaId)
    && (!fonteDestinoId || l.fonteDestinoId === fonteDestinoId));
}

export async function listar(usuarioId, filtros, { pagina = 1, porPagina = 20 } = {}) {
  // BD: duas consultas com os mesmos filtros (todas parametrizadas, nada concatenado):
  //     1) SELECT l.*, c.nome AS categoria_nome, f.nome AS fonte_destino_nome, f.tipo AS fonte_destino_tipo
  //          FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
  //          JOIN fontes_destinos f ON f.id = l.fonte_destino_id
  //         WHERE l.usuario_id = $1 AND l.data BETWEEN $2 AND $3 [AND l.tipo = ...] [AND ...]
  //         ORDER BY l.data DESC, l.id DESC LIMIT $n OFFSET $m
  //     2) SELECT COUNT(*) com os mesmos filtros (para a paginação)
  const todos = filtrar(usuarioId, filtros)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  const itens = todos.slice((pagina - 1) * porPagina, pagina * porPagina).map(comNomes);
  return { itens, total: todos.length };
}

export async function totais(usuarioId, filtros) {
  // BD: SELECT tipo, SUM(valor) FROM lancamentos WHERE usuario_id = $1 AND (mesmos filtros) GROUP BY tipo
  const lista = filtrar(usuarioId, filtros);
  const entradas = somar(lista.filter((l) => l.tipo === 'entrada').map((l) => l.valor));
  const saidas = somar(lista.filter((l) => l.tipo === 'saida').map((l) => l.valor));
  return { entradas, saidas };
}

export async function buscar(usuarioId, id) {
  // BD: mesmo SELECT com JOIN da listagem, filtrando WHERE l.id = $1 AND l.usuario_id = $2
  const lancamento = memoria.lancamentos.find((l) => l.id === id && l.usuarioId === usuarioId);
  return lancamento ? comNomes(lancamento) : null;
}

export async function listarGrupo(usuarioId, grupo) {
  // BD: SELECT ... WHERE grupo_parcelamento = $1 AND usuario_id = $2 ORDER BY parcela_atual
  return memoria.lancamentos
    .filter((l) => l.grupoParcelamento === grupo && l.usuarioId === usuarioId)
    .sort((a, b) => a.parcelaAtual - b.parcelaAtual)
    .map(comNomes);
}

// `ocorrencias` já vem pronto da rota (valor e data de cada uma).
// Parcelado: o valor foi dividido e todas guardam a data da compra original.
// Recorrente: cada mês é uma compra cheia, com a própria data.
// Precisa ser chamado dentro de transacao(): ou grava todas, ou nenhuma.
export async function criar(usuarioId, base, ocorrencias, { recorrente = false } = {}) {
  // BD: um INSERT INTO lancamentos (...) por ocorrência (ou um INSERT com vários VALUES), mesma transação.
  //     grupo_parcelamento: UUID só quando houver mais de uma parcela.
  //     grupo_recorrencia:  UUID só quando for recorrente. Os dois nunca juntos.
  const parcelado = !recorrente && ocorrencias.length > 1;
  const grupoParcelamento = parcelado ? randomUUID() : null;
  const grupoRecorrencia = recorrente ? randomUUID() : null;

  const criados = ocorrencias.map((o, i) => {
    const lancamento = {
      id: proximoId('lancamentos'),
      usuarioId,
      tipo: base.tipo,
      descricao: base.descricao,
      valor: o.valor,
      data: o.data,
      dataCompra: recorrente ? o.data : base.data,
      categoriaId: base.categoriaId,
      fonteDestinoId: base.fonteDestinoId,
      parcelaAtual: parcelado ? i + 1 : 1,
      totalParcelas: parcelado ? ocorrencias.length : 1,
      grupoParcelamento,
      grupoRecorrencia,
      criadoEm: new Date().toISOString(),
    };
    memoria.lancamentos.push(lancamento);
    return lancamento;
  });
  return criados.map(comNomes);
}

export async function atualizar(usuarioId, id, dados) {
  // BD: UPDATE lancamentos SET tipo=$1, descricao=$2, valor=$3, data=$4, data_compra=$5,
  //     categoria_id=$6, fonte_destino_id=$7 WHERE id = $8 AND usuario_id = $9 RETURNING *
  const lancamento = memoria.lancamentos.find((l) => l.id === id && l.usuarioId === usuarioId);
  if (!lancamento) return null;
  Object.assign(lancamento, dados);
  return comNomes(lancamento);
}

export async function excluir(usuarioId, id) {
  // BD: DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2  (retorna linhas afetadas)
  const indice = memoria.lancamentos.findIndex((l) => l.id === id && l.usuarioId === usuarioId);
  if (indice === -1) return 0;
  memoria.lancamentos.splice(indice, 1);
  return 1;
}

export async function excluirGrupo(usuarioId, grupo) {
  // BD: DELETE FROM lancamentos WHERE grupo_parcelamento = $1 AND usuario_id = $2
  const antes = memoria.lancamentos.length;
  memoria.lancamentos = memoria.lancamentos.filter((l) => !(l.grupoParcelamento === grupo && l.usuarioId === usuarioId));
  return antes - memoria.lancamentos.length;
}

export async function atualizarRecorrencia(usuarioId, grupo, aPartirDe, campos) {
  // BD: UPDATE lancamentos SET descricao=$1, valor=$2, categoria_id=$3, fonte_destino_id=$4, tipo=$5
  //     WHERE grupo_recorrencia = $6 AND usuario_id = $7 AND data >= $8
  const alvo = memoria.lancamentos.filter((l) => l.grupoRecorrencia === grupo && l.usuarioId === usuarioId && l.data >= aPartirDe);
  for (const l of alvo) Object.assign(l, campos);
  return alvo.length;
}

// Encerra a recorrência: apaga este mês e os seguintes; os anteriores ficam.
export async function excluirRecorrencia(usuarioId, grupo, aPartirDe = '0000-01-01') {
  // BD: DELETE FROM lancamentos WHERE grupo_recorrencia = $1 AND usuario_id = $2 AND data >= $3
  const antes = memoria.lancamentos.length;
  memoria.lancamentos = memoria.lancamentos.filter(
    (l) => !(l.grupoRecorrencia === grupo && l.usuarioId === usuarioId && l.data >= aPartirDe),
  );
  return antes - memoria.lancamentos.length;
}

export async function listarDoCartao(usuarioId, cartaoId) {
  // BD: SELECT l.id, l.descricao, l.valor, l.data_compra, l.parcela_atual, l.total_parcelas, l.grupo_recorrencia,
  //            c.nome AS categoria_nome
  //       FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
  //      WHERE l.usuario_id = $1 AND l.fonte_destino_id = $2 AND l.tipo = 'saida'
  return memoria.lancamentos
    .filter((l) => l.usuarioId === usuarioId && l.fonteDestinoId === cartaoId && l.tipo === 'saida')
    .map(comNomes);
}
