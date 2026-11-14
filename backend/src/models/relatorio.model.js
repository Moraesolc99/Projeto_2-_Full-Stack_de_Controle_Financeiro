import { memoria } from '../config/db.js';
import { deCentavos, paraCentavos } from './regras.js';

function doPeriodo(usuarioId, inicio, fim) {
  return memoria.lancamentos.filter((l) => l.usuarioId === usuarioId && l.data >= inicio && l.data <= fim);
}

function agrupar(lista, chave, inicial) {
  const grupos = new Map();
  for (const l of lista) {
    const k = chave(l);
    if (!grupos.has(k)) grupos.set(k, inicial(l));
    grupos.get(k).centavos += paraCentavos(l.valor);
  }
  return [...grupos.values()];
}

export async function somarPorCategoria(usuarioId, tipo, inicio, fim) {
  const lista = doPeriodo(usuarioId, inicio, fim).filter((l) => l.tipo === tipo);
  return agrupar(lista, (l) => l.categoriaId, (l) => {
    const c = memoria.categorias.find((x) => x.id === l.categoriaId);
    return { id: c.id, nome: c.nome, classificacao: c.classificacao, centavos: 0 };
  })
    .sort((a, b) => b.centavos - a.centavos)
    .map(({ centavos, ...resto }) => ({ ...resto, total: deCentavos(centavos) }));
}

export async function somarPorFonteDestino(usuarioId, inicio, fim) {
  const lista = doPeriodo(usuarioId, inicio, fim);
  return memoria.fontes_destinos
    .filter((f) => f.usuarioId === usuarioId)
    .map((f) => {
      const daFonte = lista.filter((l) => l.fonteDestinoId === f.id);
      const soma = (tipo) => deCentavos(daFonte.filter((l) => l.tipo === tipo)
        .reduce((t, l) => t + paraCentavos(l.valor), 0));
      return { id: f.id, nome: f.nome, tipo: f.tipo, entradas: soma('entrada'), saidas: soma('saida') };
    });
}

export async function totaisPorMes(usuarioId, inicio, fim, { parcelados } = {}) {
  const lista = doPeriodo(usuarioId, inicio, fim)
    .filter((l) => parcelados === undefined || (l.totalParcelas > 1) === parcelados);
  const meses = new Map();
  for (const l of lista) {
    const mes = l.data.slice(0, 7);
    if (!meses.has(mes)) meses.set(mes, { mes, entrada: 0, saida: 0 });
    meses.get(mes)[l.tipo] += paraCentavos(l.valor);
  }
  return [...meses.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({ mes: m.mes, entradas: deCentavos(m.entrada), saidas: deCentavos(m.saida) }));
}

export async function saldoAcumulado(usuarioId, fonteDestinoIds, ate) {
  const centavos = memoria.lancamentos
    .filter((l) => l.usuarioId === usuarioId && fonteDestinoIds.includes(l.fonteDestinoId) && l.data <= ate)
    .reduce((t, l) => t + (l.tipo === 'entrada' ? 1 : -1) * paraCentavos(l.valor), 0);
  return deCentavos(centavos);
}
