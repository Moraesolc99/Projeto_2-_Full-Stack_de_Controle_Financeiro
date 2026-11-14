import { memoria, proximoId, violacaoUnica, violacaoChaveEstrangeira } from '../config/db.js';

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

function verificarNomeUnico(usuarioId, nome, tipo, ignorarId) {
  const repetida = memoria.categorias.some(
    (c) => c.usuarioId === usuarioId && c.tipo === tipo && c.id !== ignorarId
      && c.nome.toLowerCase() === nome.toLowerCase(),
  );
  if (repetida) throw violacaoUnica('categorias_usuario_id_nome_tipo_key');
}

export async function listar(usuarioId, tipo) {
  return memoria.categorias
    .filter((c) => c.usuarioId === usuarioId && (!tipo || c.tipo === tipo))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c) => ({ ...c }));
}

export async function buscar(usuarioId, id) {
  const categoria = memoria.categorias.find((c) => c.id === id && c.usuarioId === usuarioId);
  return categoria ? { ...categoria } : null;
}

export async function criar(usuarioId, { nome, tipo, classificacao }) {
  verificarNomeUnico(usuarioId, nome, tipo);
  const categoria = { id: proximoId('categorias'), usuarioId, nome, tipo, classificacao: classificacao ?? null };
  memoria.categorias.push(categoria);
  return { ...categoria };
}

export async function criarPadrao(usuarioId) {
  for (const c of PADRAO) await criar(usuarioId, c);
}

export async function atualizar(usuarioId, id, { nome, tipo, classificacao }) {
  const categoria = memoria.categorias.find((c) => c.id === id && c.usuarioId === usuarioId);
  if (!categoria) return null;
  verificarNomeUnico(usuarioId, nome, tipo, id);
  Object.assign(categoria, { nome, tipo, classificacao: classificacao ?? null });
  return { ...categoria };
}

export async function contarLancamentos(usuarioId, id) {
  return memoria.lancamentos.filter((l) => l.categoriaId === id && l.usuarioId === usuarioId).length;
}

export async function excluir(usuarioId, id) {
  const indice = memoria.categorias.findIndex((c) => c.id === id && c.usuarioId === usuarioId);
  if (indice === -1) return false;
  if (memoria.lancamentos.some((l) => l.categoriaId === id)) throw violacaoChaveEstrangeira('lancamentos_categoria_id_fkey');
  memoria.categorias.splice(indice, 1);
  return true;
}
