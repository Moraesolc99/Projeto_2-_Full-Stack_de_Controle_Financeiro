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
  // BD: SELECT id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva
  //     FROM fontes_destinos WHERE usuario_id = $1 [AND tipo = $2] ORDER BY nome
  return memoria.fontes_destinos
    .filter((f) => f.usuarioId === usuarioId && (!tipo || f.tipo === tipo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((f) => ({ ...f }));
}

export async function buscar(usuarioId, id) {
  // BD: SELECT ... FROM fontes_destinos WHERE id = $1 AND usuario_id = $2
  const fonte = memoria.fontes_destinos.find((f) => f.id === id && f.usuarioId === usuarioId);
  return fonte ? { ...fonte } : null;
}

export async function criar(usuarioId, dados) {
  // BD: INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
  //     VALUES ($1..$7) RETURNING *
  //     O CHECK do banco também exige fechamento/vencimento/limite quando tipo = 'cartao_credito'.
  const valores = normalizar(dados);
  verificarNomeUnico(usuarioId, valores.nome);
  const fonte = { id: proximoId('fontes_destinos'), usuarioId, ...valores };
  memoria.fontes_destinos.push(fonte);
  return { ...fonte };
}

export async function criarPadrao(usuarioId) {
  // BD: INSERT com vários VALUES, na mesma transação do cadastro do usuário.
  for (const f of PADRAO) await criar(usuarioId, f);
}

export async function atualizar(usuarioId, id, dados) {
  // BD: UPDATE fontes_destinos SET nome=$1, tipo=$2, dia_fechamento=$3, dia_vencimento=$4, limite=$5, reserva=$6
  //     WHERE id = $7 AND usuario_id = $8 RETURNING *
  const fonte = memoria.fontes_destinos.find((f) => f.id === id && f.usuarioId === usuarioId);
  if (!fonte) return null;
  const valores = normalizar(dados);
  verificarNomeUnico(usuarioId, valores.nome, id);
  Object.assign(fonte, valores);
  return { ...fonte };
}

export async function contarLancamentos(usuarioId, id) {
  // BD: SELECT COUNT(*) FROM lancamentos WHERE fonte_destino_id = $1 AND usuario_id = $2
  return memoria.lancamentos.filter((l) => l.fonteDestinoId === id && l.usuarioId === usuarioId).length;
}

export async function excluir(usuarioId, id) {
  // BD: DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2
  const indice = memoria.fontes_destinos.findIndex((f) => f.id === id && f.usuarioId === usuarioId);
  if (indice === -1) return false;
  if (memoria.lancamentos.some((l) => l.fonteDestinoId === id)) {
    throw violacaoChaveEstrangeira('lancamentos_fonte_destino_id_fkey');
  }
  memoria.fontes_destinos.splice(indice, 1);
  return true;
}
