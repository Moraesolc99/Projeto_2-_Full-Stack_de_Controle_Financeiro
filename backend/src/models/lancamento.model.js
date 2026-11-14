import { randomUUID } from 'node:crypto';
import { memoria, proximoId } from '../config/db.js';
import { somar } from './regras.js';

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
  const todos = filtrar(usuarioId, filtros)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  const itens = todos.slice((pagina - 1) * porPagina, pagina * porPagina).map(comNomes);
  return { itens, total: todos.length };
}

export async function totais(usuarioId, filtros) {
  const lista = filtrar(usuarioId, filtros);
  const entradas = somar(lista.filter((l) => l.tipo === 'entrada').map((l) => l.valor));
  const saidas = somar(lista.filter((l) => l.tipo === 'saida').map((l) => l.valor));
  return { entradas, saidas };
}

export async function buscar(usuarioId, id) {
  const lancamento = memoria.lancamentos.find((l) => l.id === id && l.usuarioId === usuarioId);
  return lancamento ? comNomes(lancamento) : null;
}

export async function listarGrupo(usuarioId, grupo) {
  return memoria.lancamentos
    .filter((l) => l.grupoParcelamento === grupo && l.usuarioId === usuarioId)
    .sort((a, b) => a.parcelaAtual - b.parcelaAtual)
    .map(comNomes);
}

export async function criar(usuarioId, base, ocorrencias, { recorrente = false } = {}) {
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
  const lancamento = memoria.lancamentos.find((l) => l.id === id && l.usuarioId === usuarioId);
  if (!lancamento) return null;
  Object.assign(lancamento, dados);
  return comNomes(lancamento);
}

export async function excluir(usuarioId, id) {
  const indice = memoria.lancamentos.findIndex((l) => l.id === id && l.usuarioId === usuarioId);
  if (indice === -1) return 0;
  memoria.lancamentos.splice(indice, 1);
  return 1;
}

export async function excluirGrupo(usuarioId, grupo) {
  const antes = memoria.lancamentos.length;
  memoria.lancamentos = memoria.lancamentos.filter((l) => !(l.grupoParcelamento === grupo && l.usuarioId === usuarioId));
  return antes - memoria.lancamentos.length;
}

export async function atualizarRecorrencia(usuarioId, grupo, aPartirDe, campos) {
  const alvo = memoria.lancamentos.filter((l) => l.grupoRecorrencia === grupo && l.usuarioId === usuarioId && l.data >= aPartirDe);
  for (const l of alvo) Object.assign(l, campos);
  return alvo.length;
}

export async function excluirRecorrencia(usuarioId, grupo, aPartirDe = '0000-01-01') {
  const antes = memoria.lancamentos.length;
  memoria.lancamentos = memoria.lancamentos.filter(
    (l) => !(l.grupoRecorrencia === grupo && l.usuarioId === usuarioId && l.data >= aPartirDe),
  );
  return antes - memoria.lancamentos.length;
}

export async function listarDoCartao(usuarioId, cartaoId) {
  return memoria.lancamentos
    .filter((l) => l.usuarioId === usuarioId && l.fonteDestinoId === cartaoId && l.tipo === 'saida')
    .map(comNomes);
}
