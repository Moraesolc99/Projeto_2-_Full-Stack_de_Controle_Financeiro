import { dadosInvalidos, naoEncontrado } from '../config/erros.js';
import { cpfValido, emailValido, senhaValida, dataValida, mesCorrente } from '../models/regras.js';

const TIPOS_LANCAMENTO = ['entrada', 'saida'];
const TIPOS_FONTE = ['renda', 'conta', 'cartao_credito'];
const CLASSIFICACOES = ['necessidade', 'desejo', 'poupanca'];
export const MAX_MESES_RECORRENCIA = 60;

function texto(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lerId(valor) {
  const v = String(valor ?? '').trim();
  if (/^\d{1,10}$/.test(v) && Number(v) > 0) return Number(v);
  if (/^[a-f0-9]{24}$/i.test(v)) return v;
  return null;
}

function lerDinheiro(valor) {
  const numero = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) return null;
  return Math.round(numero * 100) / 100;
}

function lerInteiro(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
}

function falharSeHouver(campos, mensagem) {
  if (Object.keys(campos).length) throw dadosInvalidos(campos, mensagem);
}

export function validarId(req, res, next) {
  const id = lerId(req.params.id);
  if (id === null) return next(naoEncontrado());
  req.idRecurso = id;
  return next();
}

export function validarCadastro(req, res, next) {
  const corpo = req.body ?? {};
  const nome = texto(corpo.nome);
  const email = texto(corpo.email).toLowerCase();
  const cpf = String(corpo.cpf ?? '').replace(/\D/g, '');
  const { senha, confirmacaoSenha } = corpo;
  const campos = {};

  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length < 2 || nome.length > 120) campos.nome = 'O nome deve ter entre 2 e 120 caracteres.';

  if (!email) campos.email = 'Informe o e-mail.';
  else if (!emailValido(email) || email.length > 160) campos.email = 'E-mail inválido.';

  if (!cpf) campos.cpf = 'Informe o CPF.';
  else if (!cpfValido(cpf)) campos.cpf = 'CPF inválido.';

  if (!senha) campos.senha = 'Informe a senha.';
  else if (!senhaValida(senha) || senha.length > 72) campos.senha = 'A senha deve ter de 8 a 72 caracteres, com letras e números.';

  if (confirmacaoSenha !== undefined && confirmacaoSenha !== senha) {
    campos.confirmacaoSenha = 'As senhas não conferem.';
  }

  falharSeHouver(campos);
  req.dados = { nome, email, cpf, senha };
  return next();
}

export function validarLogin(req, res, next) {
  const email = texto(req.body?.email).toLowerCase();
  const senha = req.body?.senha;
  const campos = {};
  if (!email) campos.email = 'Informe o e-mail.';
  if (!senha || typeof senha !== 'string') campos.senha = 'Informe a senha.';
  falharSeHouver(campos);
  req.dados = { email, senha };
  return next();
}

export function validarCategoria(req, res, next) {
  const nome = texto(req.body?.nome);
  const tipo = req.body?.tipo;
  let classificacao = req.body?.classificacao || null;
  const campos = {};

  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 60) campos.nome = 'Máximo de 60 caracteres.';
  if (!TIPOS_LANCAMENTO.includes(tipo)) campos.tipo = 'O tipo deve ser entrada ou saída.';
  if (tipo === 'entrada') classificacao = null;
  else if (classificacao && !CLASSIFICACOES.includes(classificacao)) campos.classificacao = 'Classificação inválida.';

  falharSeHouver(campos);
  req.dados = { nome, tipo, classificacao };
  return next();
}

export function validarFonteDestino(req, res, next) {
  const corpo = req.body ?? {};
  const nome = texto(corpo.nome);
  const { tipo } = corpo;
  const campos = {};
  const dados = { nome, tipo, reserva: corpo.reserva === true };

  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 60) campos.nome = 'Máximo de 60 caracteres.';
  if (!TIPOS_FONTE.includes(tipo)) campos.tipo = 'O tipo deve ser renda, conta ou cartão de crédito.';

  if (tipo === 'cartao_credito') {
    dados.diaFechamento = lerInteiro(corpo.diaFechamento);
    dados.diaVencimento = lerInteiro(corpo.diaVencimento);
    dados.limite = lerDinheiro(corpo.limite);
    if (corpo.diaFechamento == null || corpo.diaFechamento === '') campos.diaFechamento = 'Informe o dia de fechamento.';
    else if (!dados.diaFechamento || dados.diaFechamento < 1 || dados.diaFechamento > 31) campos.diaFechamento = 'Dia entre 1 e 31.';
    if (corpo.diaVencimento == null || corpo.diaVencimento === '') campos.diaVencimento = 'Informe o dia de vencimento.';
    else if (!dados.diaVencimento || dados.diaVencimento < 1 || dados.diaVencimento > 31) campos.diaVencimento = 'Dia entre 1 e 31.';
    if (corpo.limite == null || corpo.limite === '') campos.limite = 'Informe o limite do cartão.';
    else if (dados.limite === null || dados.limite <= 0 || dados.limite > 9999999999.99) campos.limite = 'O limite deve ser maior que zero.';
  }

  falharSeHouver(campos);
  req.dados = dados;
  return next();
}

export function validarLancamento(req, res, next) {
  const corpo = req.body ?? {};
  const descricao = texto(corpo.descricao);
  const valor = lerDinheiro(corpo.valor);
  const parcelas = corpo.parcelas === undefined || corpo.parcelas === '' ? 1 : lerInteiro(corpo.parcelas);
  const campos = {};

  if (!TIPOS_LANCAMENTO.includes(corpo.tipo)) campos.tipo = 'O tipo deve ser entrada ou saída.';
  if (!descricao) campos.descricao = 'Informe a descrição.';
  else if (descricao.length > 120) campos.descricao = 'Máximo de 120 caracteres.';
  if (corpo.valor === undefined || corpo.valor === null || corpo.valor === '') campos.valor = 'Informe o valor.';
  else if (valor === null) campos.valor = 'Valor inválido.';
  else if (valor <= 0) campos.valor = 'O valor deve ser maior que zero.';
  else if (valor > 9999999999.99) campos.valor = 'Valor alto demais.';
  if (!corpo.data) campos.data = 'Informe a data.';
  else if (!dataValida(corpo.data)) campos.data = 'Data inválida (use AAAA-MM-DD).';
  if (lerId(corpo.categoriaId) === null) campos.categoriaId = 'Escolha uma categoria.';
  if (lerId(corpo.fonteDestinoId) === null) campos.fonteDestinoId = corpo.tipo === 'entrada' ? 'Escolha a fonte.' : 'Escolha o destino.';
  if (parcelas === null || parcelas < 1 || parcelas > 48) campos.parcelas = 'Número de parcelas entre 1 e 48.';
  else if (valor && parcelas > 1 && Math.round(valor * 100) < parcelas) campos.parcelas = 'Cada parcela precisa ter pelo menos R$ 0,01.';

  let meses = 1;
  const recorrente = corpo.recorrente === true;
  if (recorrente) {
    if (parcelas > 1) campos.parcelas = 'Escolha parcelado ou recorrente, não os dois.';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(corpo.repetirAte ?? ''))) {
      campos.repetirAte = 'Informe até qual mês repetir.';
    } else if (dataValida(corpo.data)) {
      const [ai, mi] = corpo.data.split('-').map(Number);
      const [af, mf] = corpo.repetirAte.split('-').map(Number);
      meses = (af - ai) * 12 + (mf - mi) + 1;
      if (meses < 2) campos.repetirAte = 'Escolha um mês depois do mês da data.';
      else if (meses > MAX_MESES_RECORRENCIA) campos.repetirAte = `No máximo ${MAX_MESES_RECORRENCIA} meses.`;
    }
  }

  falharSeHouver(campos);
  req.dados = {
    tipo: corpo.tipo,
    descricao,
    valor,
    data: corpo.data,
    categoriaId: lerId(corpo.categoriaId),
    fonteDestinoId: lerId(corpo.fonteDestinoId),
    parcelas,
    recorrencia: recorrente ? { meses } : null,
  };
  return next();
}

export function validarPeriodo(req, res, next) {
  const padrao = mesCorrente();
  const inicio = req.query.inicio || padrao.inicio;
  const fim = req.query.fim || padrao.fim;
  const campos = {};
  if (!dataValida(inicio)) campos.inicio = 'Data inicial inválida.';
  if (!dataValida(fim)) campos.fim = 'Data final inválida.';
  if (!campos.inicio && !campos.fim && inicio > fim) campos.fim = 'A data final deve ser igual ou posterior à inicial.';
  falharSeHouver(campos, 'Período inválido.');
  req.periodo = { inicio, fim };
  return next();
}

export function validarFiltrosLancamentos(req, res, next) {
  const { tipo, categoriaId, fonteDestinoId, pagina, porPagina } = req.query;
  const campos = {};
  const filtros = { ...req.periodo };

  if (tipo) {
    if (TIPOS_LANCAMENTO.includes(tipo)) filtros.tipo = tipo;
    else campos.tipo = 'Tipo inválido.';
  }
  if (categoriaId) {
    filtros.categoriaId = lerId(categoriaId);
    if (filtros.categoriaId === null) campos.categoriaId = 'Categoria inválida.';
  }
  if (fonteDestinoId) {
    filtros.fonteDestinoId = lerId(fonteDestinoId);
    if (filtros.fonteDestinoId === null) campos.fonteDestinoId = 'Fonte/destino inválido.';
  }
  const paginaNum = pagina ? lerInteiro(pagina) : 1;
  const porPaginaNum = porPagina ? lerInteiro(porPagina) : 20;
  if (!paginaNum || paginaNum < 1) campos.pagina = 'Página inválida.';
  if (!porPaginaNum || porPaginaNum < 1 || porPaginaNum > 100) campos.porPagina = 'Use de 1 a 100 itens por página.';

  falharSeHouver(campos, 'Filtros inválidos.');
  req.filtros = filtros;
  req.paginacao = { pagina: paginaNum, porPagina: porPaginaNum };
  return next();
}
