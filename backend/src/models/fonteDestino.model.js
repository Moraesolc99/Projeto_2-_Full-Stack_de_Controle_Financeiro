import { memoria, proximoId, violacaoUnica, violacaoChaveEstrangeira } from '../config/db.js';

export const PADRAO = [
  { nome: 'Conta corrente', tipo: 'conta' },
  { nome: 'Carteira', tipo: 'conta' },
];

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

function verificarNomeUnico(usuarioId, nome, ignorarId) {
  const repetida = memoria.fontes_destinos.some(
    (f) => f.usuarioId === usuarioId && f.id !== ignorarId && f.nome.toLowerCase() === nome.toLowerCase(),
  );
  if (repetida) throw violacaoUnica('fontes_destinos_usuario_id_nome_key');
}

export async function listar(usuarioId, tipo) {
  return memoria.fontes_destinos
    .filter((f) => f.usuarioId === usuarioId && (!tipo || f.tipo === tipo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((f) => ({ ...f }));
}

export async function buscar(usuarioId, id) {
  const fonte = memoria.fontes_destinos.find((f) => f.id === id && f.usuarioId === usuarioId);
  return fonte ? { ...fonte } : null;
}

export async function criar(usuarioId, dados) {
  const valores = normalizar(dados);
  verificarNomeUnico(usuarioId, valores.nome);
  const fonte = { id: proximoId('fontes_destinos'), usuarioId, ...valores };
  memoria.fontes_destinos.push(fonte);
  return { ...fonte };
}

export async function criarPadrao(usuarioId) {
  for (const f of PADRAO) await criar(usuarioId, f);
}

export async function atualizar(usuarioId, id, dados) {
  const fonte = memoria.fontes_destinos.find((f) => f.id === id && f.usuarioId === usuarioId);
  if (!fonte) return null;
  const valores = normalizar(dados);
  verificarNomeUnico(usuarioId, valores.nome, id);
  Object.assign(fonte, valores);
  return { ...fonte };
}

export async function contarLancamentos(usuarioId, id) {
  return memoria.lancamentos.filter((l) => l.fonteDestinoId === id && l.usuarioId === usuarioId).length;
}

export async function excluir(usuarioId, id) {
  const indice = memoria.fontes_destinos.findIndex((f) => f.id === id && f.usuarioId === usuarioId);
  if (indice === -1) return false;
  if (memoria.lancamentos.some((l) => l.fonteDestinoId === id)) {
    throw violacaoChaveEstrangeira('lancamentos_fonte_destino_id_fkey');
  }
  memoria.fontes_destinos.splice(indice, 1);
  return true;
}
