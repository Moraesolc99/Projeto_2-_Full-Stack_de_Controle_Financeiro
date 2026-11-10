import * as Relatorio from './relatorio.model.js';
import * as FonteDestino from './fonteDestino.model.js';
import * as Lancamento from './lancamento.model.js';
import {
  hoje, inicioDoMes, fimDoMes, somarMeses, somarDias, montarFaturas, calcularFatura,
  percentual, somar, paraCentavos, deCentavos,
} from './regras.js';

// Limites usados para gerar as dicas. Estão documentados no README.
export const LIMITES = {
  poupancaMinima: 10,
  poupancaBoa: 20,
  comprometimentoCartaoAlerta: 30,
  foraDaCurva: 30,
  foraDaCurvaValorMinimo: 50,
  reservaMinimaMeses: 3,
  reservaIdealMeses: 6,
  regra: { necessidade: 50, desejo: 30, poupanca: 20 },
};

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const nomeMes = (mes) => new Date(`${mes}-15T12:00:00Z`)
  .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function listaDeMeses(inicio, quantidade) {
  return Array.from({ length: quantidade }, (_, i) => somarMeses(inicio, i).slice(0, 7));
}

function preencherMeses(meses, dados) {
  return meses.map((mes) => dados.find((d) => d.mes === mes) ?? { mes, entradas: 0, saidas: 0 });
}

const media = (valores) => (valores.length ? deCentavos(valores.reduce((t, v) => t + paraCentavos(v), 0) / valores.length) : 0);

export async function analisar(usuarioId) {
  const dataHoje = hoje();
  const inicioMesAtual = inicioDoMes(dataHoje);
  const inicioHistorico = somarMeses(inicioMesAtual, -3);
  const fimHistorico = somarDias(inicioMesAtual, -1);
  const mesesHistorico = listaDeMeses(inicioHistorico, 3);

  const historico = preencherMeses(mesesHistorico, await Relatorio.totaisPorMes(usuarioId, inicioHistorico, fimHistorico));
  const historicoAVista = preencherMeses(
    mesesHistorico,
    await Relatorio.totaisPorMes(usuarioId, inicioHistorico, fimHistorico, { parcelados: false }),
  );

  const rendaMedia = media(historico.map((m) => m.entradas));
  const saidaMedia = media(historico.map((m) => m.saidas));
  const dicas = [];

  // 1. Taxa de poupança
  const taxaPorMes = historico.map((m) => ({
    mes: m.mes,
    taxa: m.entradas > 0 ? percentual(m.entradas - m.saidas, m.entradas) : null,
  }));
  const ultimo = taxaPorMes.at(-1);
  if (ultimo.taxa === null) {
    dicas.push({ nivel: 'info', texto: `Não houve entradas em ${nomeMes(ultimo.mes)}, então não dá para calcular a taxa de poupança.` });
  } else if (ultimo.taxa < 0) {
    dicas.push({ nivel: 'alerta', texto: `Em ${nomeMes(ultimo.mes)} você gastou mais do que recebeu (taxa de poupança de ${pct(ultimo.taxa)}).` });
  } else if (ultimo.taxa < LIMITES.poupancaMinima) {
    dicas.push({ nivel: 'atencao', texto: `Você guardou ${pct(ultimo.taxa)} da sua renda em ${nomeMes(ultimo.mes)}. Uma meta comum é guardar pelo menos ${LIMITES.poupancaMinima}%.` });
  } else {
    dicas.push({ nivel: 'positivo', texto: `Você guardou ${pct(ultimo.taxa)} da sua renda em ${nomeMes(ultimo.mes)}.${ultimo.taxa >= LIMITES.poupancaBoa ? ' Ótimo ritmo.' : ''}` });
  }

  // 2 e 3. Cartões: comprometimento das próximas faturas e parcelas futuras
  const cartoes = await FonteDestino.listar(usuarioId, 'cartao_credito');
  let proximasFaturas = 0;
  const parcelasPorMes = new Map();
  for (const cartao of cartoes) {
    const lancamentos = await Lancamento.listarDoCartao(usuarioId, cartao.id);
    const { faturas } = montarFaturas(cartao, lancamentos, 2, dataHoje);
    proximasFaturas = somar([proximasFaturas, ...faturas.filter((f) => f.situacao !== 'fechada').map((f) => f.total)]);

    for (const l of lancamentos.filter((x) => x.totalParcelas > 1)) {
      const fatura = calcularFatura(l.dataCompra, cartao, l.parcelaAtual);
      if (fatura.vencimento < dataHoje) continue;
      const mes = fatura.vencimento.slice(0, 7);
      parcelasPorMes.set(mes, (parcelasPorMes.get(mes) ?? 0) + paraCentavos(l.valor));
    }
  }
  const comprometimento = rendaMedia > 0 ? percentual(proximasFaturas, rendaMedia * 3) : null;
  if (cartoes.length && comprometimento !== null) {
    const nivel = comprometimento >= LIMITES.comprometimentoCartaoAlerta ? 'alerta' : 'positivo';
    dicas.push({ nivel, texto: `Suas faturas dos próximos 3 meses comprometem ${pct(comprometimento)} da sua renda.` });
  }

  const parcelasFuturas = [...parcelasPorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, centavos]) => ({ mes, total: deCentavos(centavos) }));
  const totalParcelas = somar(parcelasFuturas.map((p) => p.total));
  if (totalParcelas > 0) {
    dicas.push({ nivel: 'info', texto: `Você tem ${brl(totalParcelas)} em parcelas até ${nomeMes(parcelasFuturas.at(-1).mes)}.` });
  }

  // 4. Regra 50/30/20 (sobre a renda dos últimos 3 meses)
  const saidasClassificadas = await Relatorio.somarPorCategoria(usuarioId, 'saida', inicioHistorico, fimHistorico);
  const rendaTotal = somar(historico.map((m) => m.entradas));
  const porClasse = { necessidade: 0, desejo: 0, poupanca: 0 };
  for (const c of saidasClassificadas) {
    porClasse[c.classificacao ?? 'desejo'] = somar([porClasse[c.classificacao ?? 'desejo'], c.total]);
  }
  const naoGasto = Math.max(0, deCentavos(paraCentavos(rendaTotal) - paraCentavos(somar(historico.map((m) => m.saidas)))));
  const regra = rendaTotal > 0 ? {
    necessidade: percentual(porClasse.necessidade, rendaTotal),
    desejo: percentual(porClasse.desejo, rendaTotal),
    poupanca: percentual(somar([porClasse.poupanca, naoGasto]), rendaTotal),
  } : null;
  if (regra) {
    if (regra.necessidade > LIMITES.regra.necessidade) {
      dicas.push({ nivel: 'atencao', texto: `Os gastos com necessidades estão em ${pct(regra.necessidade)} da renda (referência: ${LIMITES.regra.necessidade}%).` });
    }
    if (regra.desejo > LIMITES.regra.desejo) {
      dicas.push({ nivel: 'atencao', texto: `Os gastos com desejos estão em ${pct(regra.desejo)} da renda (referência: ${LIMITES.regra.desejo}%).` });
    }
    if (regra.poupanca >= LIMITES.regra.poupanca) {
      dicas.push({ nivel: 'positivo', texto: `Você está poupando ou investindo ${pct(regra.poupanca)} da renda, acima da referência de ${LIMITES.regra.poupanca}%.` });
    }
  }

  // 5. Categoria fora da curva: mês atual x média dos 3 anteriores
  const atual = await Relatorio.somarPorCategoria(usuarioId, 'saida', inicioMesAtual, dataHoje);
  const foraDaCurva = [];
  for (const c of atual) {
    const anterior = saidasClassificadas.find((x) => x.id === c.id);
    const mediaAnterior = anterior ? deCentavos(paraCentavos(anterior.total) / 3) : 0;
    if (mediaAnterior <= 0 || c.total < LIMITES.foraDaCurvaValorMinimo) continue;
    const variacao = percentual(c.total - mediaAnterior, mediaAnterior);
    if (variacao >= LIMITES.foraDaCurva) {
      foraDaCurva.push({ categoria: c.nome, atual: c.total, media: mediaAnterior, variacao });
      dicas.push({ nivel: 'atencao', texto: `Seus gastos com ${c.nome} já estão ${pct(variacao)} acima da sua média dos últimos 3 meses.` });
    }
  }

  // 6. Reserva de emergência
  const reservas = (await FonteDestino.listar(usuarioId, 'conta')).filter((f) => f.reserva);
  const saldoReserva = reservas.length ? await Relatorio.saldoAcumulado(usuarioId, reservas.map((r) => r.id), dataHoje) : 0;
  const mesesCobertos = saidaMedia > 0 ? Math.round((saldoReserva / saidaMedia) * 10) / 10 : null;
  if (!reservas.length) {
    dicas.push({ nivel: 'info', texto: 'Marque como reserva a conta onde você guarda dinheiro para emergências (em Fontes e destinos) para acompanhar esse indicador.' });
  } else if (mesesCobertos !== null) {
    const nivel = mesesCobertos < LIMITES.reservaMinimaMeses ? 'atencao' : 'positivo';
    dicas.push({ nivel, texto: `Sua reserva cobre ${mesesCobertos.toLocaleString('pt-BR')} ${mesesCobertos === 1 ? 'mês' : 'meses'} de despesas. Uma referência comum é de ${LIMITES.reservaMinimaMeses} a ${LIMITES.reservaIdealMeses} meses.` });
  }

  // 7. Projeção de saldo: média das entradas e dos gastos à vista + parcelas já lançadas
  const saldoAtual = await Relatorio.saldoAcumulado(
    usuarioId,
    (await FonteDestino.listar(usuarioId)).map((f) => f.id),
    dataHoje,
  );
  const saidaMediaAVista = media(historicoAVista.map((m) => m.saidas));
  const inicioProjecao = somarMeses(inicioMesAtual, 1);
  const mesesProjecao = listaDeMeses(inicioProjecao, 6);
  const parceladosFuturos = await Relatorio.totaisPorMes(
    usuarioId, inicioProjecao, fimDoMes(somarMeses(inicioProjecao, 5)), { parcelados: true },
  );
  let saldoCentavos = paraCentavos(saldoAtual);
  const projecao = mesesProjecao.map((mes) => {
    const parcelas = parceladosFuturos.find((p) => p.mes === mes)?.saidas ?? 0;
    const saidas = somar([saidaMediaAVista, parcelas]);
    saldoCentavos += paraCentavos(rendaMedia) - paraCentavos(saidas);
    return { mes, entradas: rendaMedia, saidas, parcelas, saldo: deCentavos(saldoCentavos) };
  });
  const negativo = projecao.find((p) => p.saldo < 0);
  if (negativo) {
    dicas.push({ nivel: 'alerta', texto: `Mantido o ritmo atual, seu saldo fica negativo em ${nomeMes(negativo.mes)}.` });
  }

  const ordem = { alerta: 0, atencao: 1, info: 2, positivo: 3 };
  dicas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);

  return {
    geradoEm: dataHoje,
    aviso: 'As informações desta página são educativas e não constituem recomendação financeira profissional.',
    base: { inicio: inicioHistorico, fim: fimHistorico, rendaMedia, saidaMedia },
    indicadores: {
      taxaPoupanca: { porMes: taxaPorMes, ultimoMes: ultimo.taxa, referencia: LIMITES.poupancaMinima },
      comprometimentoCartoes: { proximasFaturas, percentualDaRenda: comprometimento, referencia: LIMITES.comprometimentoCartaoAlerta },
      parcelasFuturas: { total: totalParcelas, porMes: parcelasFuturas },
      regra503020: { atual: regra, referencia: LIMITES.regra },
      foraDaCurva,
      reserva: { contas: reservas.map((r) => r.nome), saldo: saldoReserva, mesesCobertos, referencia: [LIMITES.reservaMinimaMeses, LIMITES.reservaIdealMeses] },
    },
    projecao: { saldoAtual, meses: projecao },
    dicas,
  };
}
