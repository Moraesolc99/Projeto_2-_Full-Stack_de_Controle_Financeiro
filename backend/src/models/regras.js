// Regras de negócio puras (sem acesso a banco). Usadas pelas rotas e pelos models.

export function cpfValido(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? ''));

export const senhaValida = (senha) =>
  typeof senha === 'string' && senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha);

// ---------- dinheiro (sempre em centavos para não errar arredondamento) ----------

export const paraCentavos = (valor) => Math.round(Number(valor) * 100);
export const deCentavos = (centavos) => Math.round(centavos) / 100;

export function somar(valores) {
  return deCentavos(valores.reduce((total, v) => total + paraCentavos(v), 0));
}

export function dividirEmParcelas(valor, quantidade) {
  const total = paraCentavos(valor);
  const base = Math.floor(total / quantidade);
  const sobra = total - base * quantidade;
  return Array.from({ length: quantidade }, (_, i) => deCentavos(i === 0 ? base + sobra : base));
}

export function percentual(parte, todo) {
  if (!todo) return 0;
  return Math.round((parte / todo) * 10000) / 100;
}

// ---------- datas (strings AAAA-MM-DD, calculadas em UTC) ----------

export function hoje() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texto ?? ''))) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function dataSegura(ano, mes, dia) {
  const a = ano + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return new Date(Date.UTC(a, m, Math.min(dia, ultimoDiaDoMes(a, m))));
}

const iso = (data) => data.toISOString().slice(0, 10);

export function somarMeses(dataIso, meses) {
  const [a, m, d] = dataIso.split('-').map(Number);
  return iso(dataSegura(a, m - 1 + meses, d));
}

export function somarDias(dataIso, dias) {
  const [a, m, d] = dataIso.split('-').map(Number);
  return iso(new Date(Date.UTC(a, m - 1, d + dias)));
}

export function inicioDoMes(dataIso) {
  return `${dataIso.slice(0, 7)}-01`;
}

export function fimDoMes(dataIso) {
  const [a, m] = dataIso.split('-').map(Number);
  return iso(new Date(Date.UTC(a, m, 0)));
}

export function mesCorrente() {
  const h = hoje();
  return { inicio: inicioDoMes(h), fim: fimDoMes(h) };
}

// Mesmo tamanho do período informado, imediatamente antes dele.
// Se o período for de meses inteiros, volta a mesma quantidade de meses (out → set).
export function periodoAnterior(inicio, fim) {
  const mesesInteiros = inicio.endsWith('-01') && fim === fimDoMes(fim);
  if (mesesInteiros) {
    const [ai, mi] = inicio.split('-').map(Number);
    const [af, mf] = fim.split('-').map(Number);
    const qtd = (af - ai) * 12 + (mf - mi) + 1;
    const novoInicio = somarMeses(inicio, -qtd);
    return { inicio: novoInicio, fim: fimDoMes(somarMeses(novoInicio, qtd - 1)) };
  }
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1;
  const novoFim = somarDias(inicio, -1);
  return { inicio: somarDias(novoFim, -(dias - 1)), fim: novoFim };
}

// ---------- faturas de cartão ----------

// Regra do enunciado: compra antes do dia de fechamento entra na fatura que fecha no mesmo mês;
// no dia do fechamento ou depois, na do mês seguinte. A parcela k cai k-1 meses depois.
export function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));

  let mesFechamento = dia < fechamentoDoMes ? m : m + 1;
  mesFechamento += numeroParcela - 1;

  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);

  return { referencia: iso(vencimento).slice(0, 7), fechamento: iso(fechamento), vencimento: iso(vencimento) };
}

function datasDaReferencia(referencia, cartao) {
  const [ano, mes] = referencia.split('-').map(Number);
  const mesVenc = mes - 1;
  const mesFech = cartao.diaVencimento > cartao.diaFechamento ? mesVenc : mesVenc - 1;
  return {
    referencia,
    fechamento: iso(dataSegura(ano, mesFech, cartao.diaFechamento)),
    vencimento: iso(dataSegura(ano, mesVenc, cartao.diaVencimento)),
  };
}

function somarMesesReferencia(referencia, meses) {
  return somarMeses(`${referencia}-01`, meses).slice(0, 7);
}

// Monta a fatura aberta + as próximas `meses` faturas de um cartão.
// `lancamentos` são as saídas do cartão; cada uma guarda a data da compra e o número da parcela.
// Limite utilizado = tudo que já foi comprado e cuja fatura ainda não venceu.
export function montarFaturas(cartao, lancamentos, meses = 3, dataBase = hoje()) {
  const porReferencia = new Map();
  let comprometidoCentavos = 0;

  for (const l of lancamentos) {
    const fatura = calcularFatura(l.dataCompra, cartao, l.parcelaAtual);
    // Mensalidade futura ainda não foi cobrada, então não ocupa limite. Parcela futura ocupa.
    const cobrancaFutura = l.grupoRecorrencia && l.dataCompra > dataBase;
    if (fatura.vencimento >= dataBase && !cobrancaFutura) comprometidoCentavos += paraCentavos(l.valor);
    if (!porReferencia.has(fatura.referencia)) porReferencia.set(fatura.referencia, []);
    porReferencia.get(fatura.referencia).push(l);
  }

  const aberta = calcularFatura(dataBase, cartao).referencia;
  const referencias = [];

  // Fatura já fechada que ainda não venceu (aguardando pagamento)
  const anterior = somarMesesReferencia(aberta, -1);
  if (datasDaReferencia(anterior, cartao).vencimento >= dataBase && porReferencia.has(anterior)) {
    referencias.push({ ref: anterior, situacao: 'fechada' });
  }
  referencias.push({ ref: aberta, situacao: 'aberta' });
  for (let i = 1; i <= meses; i++) referencias.push({ ref: somarMesesReferencia(aberta, i), situacao: 'futura' });

  const faturas = referencias.map(({ ref, situacao }) => {
    const itens = (porReferencia.get(ref) ?? [])
      .sort((a, b) => a.dataCompra.localeCompare(b.dataCompra) || a.id - b.id)
      .map((l) => ({
        id: l.id,
        descricao: l.descricao,
        categoria: l.categoriaNome,
        dataCompra: l.dataCompra,
        valor: l.valor,
        parcelaAtual: l.parcelaAtual,
        totalParcelas: l.totalParcelas,
        recorrente: Boolean(l.grupoRecorrencia),
        rotulo: l.totalParcelas > 1 ? `${l.descricao} — ${l.parcelaAtual}/${l.totalParcelas}` : l.descricao,
      }));
    return { ...datasDaReferencia(ref, cartao), situacao, total: somar(itens.map((i) => i.valor)), itens };
  });

  const limiteUtilizado = deCentavos(comprometidoCentavos);
  return {
    limite: cartao.limite,
    limiteUtilizado,
    limiteDisponivel: deCentavos(paraCentavos(cartao.limite) - comprometidoCentavos),
    faturas,
  };
}
