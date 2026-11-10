import { memoria } from '../config/db.js';
import { deCentavos, paraCentavos } from './regras.js';

// No banco, todas estas funções são um SELECT com SUM + GROUP BY.
// Aqui em memória fazemos o mesmo agrupamento à mão, sempre em centavos.

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
  // BD: SELECT c.id, c.nome, c.classificacao, SUM(l.valor) AS total
  //       FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
  //      WHERE l.usuario_id = $1 AND l.tipo = $2 AND l.data BETWEEN $3 AND $4
  //      GROUP BY c.id, c.nome, c.classificacao ORDER BY total DESC
  const lista = doPeriodo(usuarioId, inicio, fim).filter((l) => l.tipo === tipo);
  return agrupar(lista, (l) => l.categoriaId, (l) => {
    const c = memoria.categorias.find((x) => x.id === l.categoriaId);
    return { id: c.id, nome: c.nome, classificacao: c.classificacao, centavos: 0 };
  })
    .sort((a, b) => b.centavos - a.centavos)
    .map(({ centavos, ...resto }) => ({ ...resto, total: deCentavos(centavos) }));
}

export async function somarPorFonteDestino(usuarioId, inicio, fim) {
  // BD: SELECT f.id, f.nome, f.tipo,
  //            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
  //            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0)   AS saidas
  //       FROM fontes_destinos f
  //       LEFT JOIN lancamentos l ON l.fonte_destino_id = f.id AND l.data BETWEEN $2 AND $3
  //      WHERE f.usuario_id = $1
  //      GROUP BY f.id, f.nome, f.tipo
  //     (MySQL: SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE 0 END))
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

// `parcelados`: true = só compras parceladas, false = só à vista, undefined = tudo
export async function totaisPorMes(usuarioId, inicio, fim, { parcelados } = {}) {
  // BD: SELECT to_char(data, 'YYYY-MM') AS mes,
  //            SUM(valor) FILTER (WHERE tipo = 'entrada') AS entradas,
  //            SUM(valor) FILTER (WHERE tipo = 'saida')   AS saidas
  //       FROM lancamentos WHERE usuario_id = $1 AND data BETWEEN $2 AND $3
  //            [AND total_parcelas > 1]  ou  [AND total_parcelas = 1]
  //      GROUP BY mes ORDER BY mes
  //     (MySQL: DATE_FORMAT(data, '%Y-%m'))
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
  // BD: SELECT SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END) AS saldo
  //       FROM lancamentos WHERE usuario_id = $1 AND fonte_destino_id = ANY($2) AND data <= $3
  const centavos = memoria.lancamentos
    .filter((l) => l.usuarioId === usuarioId && fonteDestinoIds.includes(l.fonteDestinoId) && l.data <= ate)
    .reduce((t, l) => t + (l.tipo === 'entrada' ? 1 : -1) * paraCentavos(l.valor), 0);
  return deCentavos(centavos);
}
