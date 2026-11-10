const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const moeda = (valor) => formatoMoeda.format(Number(valor) || 0);

export const percentual = (valor) =>
  valor === null || valor === undefined ? '—' : `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

// Datas da API chegam como AAAA-MM-DD; montar à mão evita o "um dia a menos" do fuso horário.
export function data(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function nomeMes(referencia, curto = false) {
  const [a, m] = referencia.split('-').map(Number);
  if (curto) return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
  const nome = MESES[m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
}

export function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

export function periodoDoMes(referencia) {
  const [a, m] = referencia.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { inicio: `${referencia}-01`, fim: `${referencia}-${String(ultimo).padStart(2, '0')}` };
}

export function mesAtual() {
  return hojeIso().slice(0, 7);
}

export function mesVizinho(referencia, deslocamento) {
  const [a, m] = referencia.split('-').map(Number);
  const d = new Date(a, m - 1 + deslocamento, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function mascaraCpf(valor) {
  const d = String(valor).replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function cpfValido(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export const NOMES_TIPO_FONTE = { renda: 'Renda', conta: 'Conta', cartao_credito: 'Cartão de crédito' };
export const NOMES_CLASSIFICACAO = { necessidade: 'Necessidade', desejo: 'Desejo', poupanca: 'Poupança' };
