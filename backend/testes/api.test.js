import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';
import { calcularFatura, hoje, inicioDoMes, somarDias, somarMeses } from '../src/models/regras.js';

const PORTA = 3999;
const SEGREDO_TESTE = 'segredo-so-para-os-testes';
const URL_BASE = `http://localhost:${PORTA}/api`;
let servidor;

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const resposta = await fetch(URL_BASE + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, dados: texto ? JSON.parse(texto) : null };
}

async function entrar(email, senha = 'senha1234') {
  const { dados } = await chamar('POST', '/auth/login', { corpo: { email, senha } });
  return dados.token;
}

before(async () => {
  servidor = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, PORT: String(PORTA), MODO_BANCO: 'memoria', LOGIN_MAX_TENTATIVAS: '1000', JWT_SECRET: SEGREDO_TESTE },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    servidor.stdout.on('data', (d) => d.toString().includes('API rodando') && resolve());
    servidor.on('exit', (codigo) => reject(new Error(`servidor saiu com código ${codigo}`)));
  });
});

after(() => servidor?.kill());

const novoUsuario = {
  nome: 'Carla Teste',
  email: 'Carla@Teste.com',
  cpf: '935.411.347-80',
  senha: 'abc12345',
  confirmacaoSenha: 'abc12345',
};

test('cadastro valida campos no servidor', async () => {
  const { status, dados } = await chamar('POST', '/auth/cadastro', {
    corpo: { nome: '', email: 'x', cpf: '529.982.247-24', senha: '12345678' },
  });
  assert.equal(status, 400);
  assert.ok(dados.campos.nome && dados.campos.email && dados.campos.cpf && dados.campos.senha);
});

test('cadastro cria usuário, não devolve hash e cria categorias/fontes padrão', async () => {
  const { status, dados } = await chamar('POST', '/auth/cadastro', { corpo: novoUsuario });
  assert.equal(status, 201);
  assert.equal(dados.email, 'carla@teste.com');
  assert.equal(JSON.stringify(dados).includes('senha'), false);

  const token = await entrar('carla@teste.com', 'abc12345');
  const categorias = await chamar('GET', '/categorias', { token });
  const fontes = await chamar('GET', '/fontes-destinos', { token });
  assert.ok(categorias.dados.length >= 8);
  assert.ok(fontes.dados.some((f) => f.nome === 'Conta corrente'));
});

test('e-mail repetido (com maiúsculas) e CPF repetido (sem pontuação) dão 409 no campo certo', async () => {
  const emailRepetido = await chamar('POST', '/auth/cadastro', {
    corpo: { ...novoUsuario, email: '  CARLA@teste.COM ', cpf: '390.533.447-05' },
  });
  assert.equal(emailRepetido.status, 409);
  assert.ok(emailRepetido.dados.campos.email);

  const cpfRepetido = await chamar('POST', '/auth/cadastro', {
    corpo: { ...novoUsuario, email: 'outra@teste.com', cpf: '93541134780' },
  });
  assert.equal(cpfRepetido.status, 409);
  assert.ok(cpfRepetido.dados.campos.cpf);
  assert.equal(cpfRepetido.dados.campos.email, undefined);
});

test('login: senha errada e e-mail inexistente dão a mesma resposta 401', async () => {
  const errada = await chamar('POST', '/auth/login', { corpo: { email: 'ana@email.com', senha: 'errada123' } });
  const inexistente = await chamar('POST', '/auth/login', { corpo: { email: 'ninguem@email.com', senha: 'errada123' } });
  assert.equal(errada.status, 401);
  assert.deepEqual(errada.dados, inexistente.dados);
});

test('rotas protegidas exigem token válido e não expirado', async () => {
  assert.equal((await chamar('GET', '/lancamentos')).status, 401);
  assert.equal((await chamar('GET', '/lancamentos', { token: 'abc' })).status, 401);
  const expirado = jwt.sign({}, SEGREDO_TESTE, { subject: '1', expiresIn: -10 });
  assert.equal((await chamar('GET', '/lancamentos', { token: expirado })).status, 401);
  const me = await chamar('GET', '/auth/me', { token: await entrar('ana@email.com') });
  assert.equal(me.status, 200);
  assert.equal(me.dados.senhaHash, undefined);
});

test('isolamento: usuário A não lê, edita nem exclui dados de B', async () => {
  const tokenAna = await entrar('ana@email.com');
  const tokenBruno = await entrar('bruno@email.com');
  const doBruno = (await chamar('GET', '/lancamentos?inicio=2000-01-01&fim=2100-12-31', { token: tokenBruno })).dados.itens[0];
  const categoriaBruno = (await chamar('GET', '/categorias', { token: tokenBruno })).dados[0];

  assert.equal((await chamar('GET', `/lancamentos/${doBruno.id}`, { token: tokenAna })).status, 404);
  assert.equal((await chamar('PUT', `/lancamentos/${doBruno.id}`, { token: tokenAna, corpo: { ...doBruno, valor: 1 } })).status, 404);
  assert.equal((await chamar('DELETE', `/lancamentos/${doBruno.id}`, { token: tokenAna })).status, 404);
  assert.equal((await chamar('DELETE', `/categorias/${categoriaBruno.id}`, { token: tokenAna })).status, 404);
  assert.equal((await chamar('GET', `/lancamentos/${doBruno.id}`, { token: tokenBruno })).status, 200);
});

test('lançamento valida tipo da categoria e posse da fonte', async () => {
  const token = await entrar('ana@email.com');
  const categorias = (await chamar('GET', '/categorias', { token })).dados;
  const fontes = (await chamar('GET', '/fontes-destinos', { token })).dados;
  const salario = categorias.find((c) => c.nome === 'Salário');
  const conta = fontes.find((f) => f.nome === 'Conta corrente');

  const tipoErrado = await chamar('POST', '/lancamentos', {
    token,
    corpo: { tipo: 'saida', descricao: 'X', valor: 10, data: '2026-10-01', categoriaId: salario.id, fonteDestinoId: conta.id },
  });
  assert.equal(tipoErrado.status, 400);
  assert.ok(tipoErrado.dados.campos.categoriaId);

  const valorZero = await chamar('POST', '/lancamentos', {
    token,
    corpo: { tipo: 'entrada', descricao: 'X', valor: 0, data: '2026-02-30', categoriaId: salario.id, fonteDestinoId: conta.id },
  });
  assert.equal(valorZero.status, 400);
  assert.ok(valorZero.dados.campos.valor && valorZero.dados.campos.data);

  const fonteDeOutro = await chamar('POST', '/lancamentos', {
    token,
    corpo: { tipo: 'entrada', descricao: 'X', valor: 10, data: '2026-10-01', categoriaId: salario.id, fonteDestinoId: 999999 },
  });
  assert.equal(fonteDeOutro.status, 404);
});

test('parcelamento: R$ 100 em 3x soma exatamente 100 e cai nas faturas certas', async () => {
  const token = await entrar('ana@email.com');
  const categorias = (await chamar('GET', '/categorias', { token })).dados;
  const fontes = (await chamar('GET', '/fontes-destinos', { token })).dados;
  const cartao = (await chamar('POST', '/fontes-destinos', {
    token,
    corpo: { nome: 'Cartão Teste', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 1000 },
  })).dados;

  const semCartao = await chamar('POST', '/fontes-destinos', { token, corpo: { nome: 'Sem dados', tipo: 'cartao_credito' } });
  assert.equal(semCartao.status, 400);

  const naConta = await chamar('POST', '/lancamentos', {
    token,
    corpo: {
      tipo: 'saida', descricao: 'Parcelar na conta', valor: 100, data: '2026-11-03', parcelas: 3,
      categoriaId: categorias.find((c) => c.nome === 'Lazer').id, fonteDestinoId: fontes.find((f) => f.nome === 'Conta corrente').id,
    },
  });
  assert.equal(naConta.status, 400);

  const { status, dados } = await chamar('POST', '/lancamentos', {
    token,
    corpo: {
      tipo: 'saida', descricao: 'Fone', valor: 100, data: '2026-11-03', parcelas: 3,
      categoriaId: categorias.find((c) => c.nome === 'Lazer').id, fonteDestinoId: cartao.id,
    },
  });
  assert.equal(status, 201);
  assert.deepEqual(dados.lancamentos.map((l) => l.valor), [33.34, 33.33, 33.33]);
  assert.equal(new Set(dados.lancamentos.map((l) => l.grupoParcelamento)).size, 1);

  const faturas = (await chamar('GET', '/relatorios/faturas?meses=3', { token })).dados;
  const doCartao = faturas.cartoes.find((c) => c.cartao.id === cartao.id);
  const referencias = doCartao.faturas.filter((f) => f.itens.length).map((f) => f.referencia);
  assert.deepEqual(referencias, ['2026-12', '2027-01', '2027-02']);
  assert.equal(doCartao.limiteUtilizado, 100);
  assert.equal(doCartao.limiteDisponivel, 900);

  const umaParcela = await chamar('DELETE', `/lancamentos/${dados.lancamentos[1].id}`, { token });
  assert.equal(umaParcela.status, 204);
  const todas = await chamar('DELETE', `/lancamentos/${dados.lancamentos[0].id}?todasParcelas=true`, { token });
  assert.equal(todas.status, 204);
  assert.equal((await chamar('GET', `/lancamentos/${dados.lancamentos[2].id}`, { token })).status, 404);
  assert.equal((await chamar('DELETE', `/fontes-destinos/${cartao.id}`, { token })).status, 204);
});

test('categoria com lançamentos não pode ser excluída e nome repetido dá 409', async () => {
  const token = await entrar('ana@email.com');
  const alimentacao = (await chamar('GET', '/categorias', { token })).dados.find((c) => c.nome === 'Alimentação');
  assert.equal((await chamar('DELETE', `/categorias/${alimentacao.id}`, { token })).status, 409);
  const repetida = await chamar('POST', '/categorias', { token, corpo: { nome: 'alimentação', tipo: 'saida' } });
  assert.equal(repetida.status, 409);
  assert.ok(repetida.dados.campos.nome);
  const mesmoNomeOutroTipo = await chamar('POST', '/categorias', { token, corpo: { nome: 'Alimentação', tipo: 'entrada' } });
  assert.equal(mesmoNomeOutroTipo.status, 201);
  assert.equal((await chamar('DELETE', `/categorias/${mesmoNomeOutroTipo.dados.id}`, { token })).status, 204);
});

test('listagem tem filtros, paginação e totais', async () => {
  const token = await entrar('ana@email.com');
  const { status, dados } = await chamar('GET', '/lancamentos?inicio=2026-08-01&fim=2026-10-31&tipo=saida&porPagina=5&pagina=2', { token });
  assert.equal(status, 200);
  assert.equal(dados.itens.length, 5);
  assert.ok(dados.itens.every((l) => l.tipo === 'saida'));
  assert.equal(dados.totais.entradas, 0);
  assert.ok(dados.totais.saidas > 0);
  assert.equal((await chamar('GET', '/lancamentos?inicio=2026-10-31&fim=2026-10-01', { token })).status, 400);
});

test('relatórios por categoria, por fonte/destino e saúde financeira', async () => {
  const token = await entrar('ana@email.com');
  const categorias = (await chamar('GET', '/relatorios/categorias?inicio=2026-10-01&fim=2026-10-31', { token })).dados;
  assert.deepEqual(categorias.periodoAnterior, { inicio: '2026-09-01', fim: '2026-09-30' });
  const somaPercentuais = categorias.categorias.reduce((t, c) => t + c.percentual, 0);
  assert.ok(Math.abs(somaPercentuais - 100) < 0.1);

  const fontes = (await chamar('GET', '/relatorios/fontes-destinos?inicio=2026-10-01&fim=2026-10-31', { token })).dados;
  assert.ok(fontes.contas.some((c) => c.nome === 'Conta corrente'));

  const saude = (await chamar('GET', '/saude-financeira', { token })).dados;
  assert.ok(saude.aviso.includes('não constituem recomendação'));
  assert.equal(saude.projecao.meses.length, 6);
  assert.ok(saude.dicas.length >= 3);
});

test('recorrência mensal: valor cheio todo mês, editar os seguintes e encerrar', async () => {
  const token = await entrar('ana@email.com');
  const lazer = (await chamar('GET', '/categorias', { token })).dados.find((c) => c.nome === 'Lazer');
  const cartao = (await chamar('POST', '/fontes-destinos', {
    token,
    corpo: { nome: 'Cartão Recorrência', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 1000 },
  })).dados;
  const base = { tipo: 'saida', descricao: 'Música', valor: 21.9, categoriaId: lazer.id, fonteDestinoId: cartao.id };
  const regrasCartao = { diaFechamento: 3, diaVencimento: 10 };
  const datas = [0, 1, 2, 3].map((m) => somarMeses(somarDias(inicioDoMes(hoje()), 14), m));
  const mesInicial = datas[0].slice(0, 7);
  const mesFinal = datas[3].slice(0, 7);

  const comParcelas = await chamar('POST', '/lancamentos', { token, corpo: { ...base, data: datas[0], parcelas: 3, recorrente: true, repetirAte: mesFinal } });
  assert.equal(comParcelas.status, 400);
  const semFim = await chamar('POST', '/lancamentos', { token, corpo: { ...base, data: datas[0], recorrente: true } });
  assert.equal(semFim.status, 400);
  assert.ok(semFim.dados.campos.repetirAte);
  const mesmoMes = await chamar('POST', '/lancamentos', { token, corpo: { ...base, data: datas[0], recorrente: true, repetirAte: mesInicial } });
  assert.equal(mesmoMes.status, 400);

  const { status, dados } = await chamar('POST', '/lancamentos', {
    token, corpo: { ...base, data: datas[0], recorrente: true, repetirAte: mesFinal },
  });
  assert.equal(status, 201);
  const criados = dados.lancamentos;
  assert.deepEqual(criados.map((l) => l.data), datas);
  assert.ok(criados.every((l) => l.valor === 21.9 && l.totalParcelas === 1 && l.grupoRecorrencia === criados[0].grupoRecorrencia));

  const faturas = (await chamar('GET', '/relatorios/faturas?meses=3', { token })).dados.cartoes.find((c) => c.cartao.id === cartao.id);
  const janela = faturas.faturas.map((f) => f.referencia);
  const esperadas = criados.map((l) => calcularFatura(l.data, regrasCartao).referencia).filter((r) => janela.includes(r));
  assert.ok(esperadas.length >= 3);
  const comItens = faturas.faturas.filter((f) => f.itens.length).map((f) => f.referencia);
  assert.deepEqual(comItens, esperadas);
  assert.ok(faturas.faturas.flatMap((f) => f.itens).every((i) => i.recorrente));
  const hojeIso = hoje();
  const cobradas = criados.filter((l) => l.data <= hojeIso
    && calcularFatura(l.data, regrasCartao).vencimento >= hojeIso);
  assert.equal(faturas.limiteUtilizado, Math.round(cobradas.length * 2190) / 100);

  const terceiro = criados[2];
  const editado = await chamar('PUT', `/lancamentos/${terceiro.id}?aplicarSeguintes=true`, {
    token, corpo: { ...base, valor: 24.9, data: terceiro.data },
  });
  assert.equal(editado.status, 200);
  const valores = await Promise.all(criados.map(async (l) => (await chamar('GET', `/lancamentos/${l.id}`, { token })).dados.valor));
  assert.deepEqual(valores, [21.9, 21.9, 24.9, 24.9]);

  assert.equal((await chamar('DELETE', `/lancamentos/${terceiro.id}?recorrencia=seguintes`, { token })).status, 204);
  const restantes = await Promise.all(criados.map(async (l) => (await chamar('GET', `/lancamentos/${l.id}`, { token })).status));
  assert.deepEqual(restantes, [200, 200, 404, 404]);

  assert.equal((await chamar('DELETE', `/lancamentos/${criados[0].id}?recorrencia=todas`, { token })).status, 204);
  assert.equal((await chamar('GET', `/lancamentos/${criados[1].id}`, { token })).status, 404);
  assert.equal((await chamar('DELETE', `/fontes-destinos/${cartao.id}`, { token })).status, 204);
});
