import bcrypt from 'bcrypt';
import * as Usuario from '../src/models/usuario.model.js';
import * as Categoria from '../src/models/categoria.model.js';
import * as FonteDestino from '../src/models/fonteDestino.model.js';
import * as Lancamento from '../src/models/lancamento.model.js';
import { hoje, inicioDoMes, somarMeses, fimDoMes, dividirEmParcelas } from '../src/models/regras.js';

const dataHoje = hoje();
const mesAtual = inicioDoMes(dataHoje);

function dia(mesesAtras, numeroDia) {
  const inicio = somarMeses(mesAtual, -mesesAtras);
  const ultimo = Number(fimDoMes(inicio).slice(8));
  return `${inicio.slice(0, 8)}${String(Math.min(numeroDia, ultimo)).padStart(2, '0')}`;
}

async function prepararUsuario({ nome, email, cpf, senha }, extras) {
  const usuario = await Usuario.criar({ nome, email, cpf, senhaHash: await bcrypt.hash(senha, 10) });
  await Categoria.criarPadrao(usuario.id);
  await FonteDestino.criarPadrao(usuario.id);
  for (const f of extras) await FonteDestino.criar(usuario.id, f);

  const categorias = await Categoria.listar(usuario.id);
  const fontes = await FonteDestino.listar(usuario.id);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const fonte = (nome) => fontes.find((f) => f.nome === nome).id;

  async function lancar(tipo, descricao, valor, data, categoria, fonteDestino, parcelas = 1) {
    if (data > dataHoje) return;
    const base = { tipo, descricao, valor, data, categoriaId: cat(categoria), fonteDestinoId: fonte(fonteDestino) };
    const lista = dividirEmParcelas(valor, parcelas).map((v, i) => ({ valor: v, data: somarMeses(data, i) }));
    await Lancamento.criar(usuario.id, base, lista);
  }

  lancar.mensal = async (tipo, descricao, valor, data, ate, categoria, fonteDestino) => {
    const base = { tipo, descricao, valor, data, categoriaId: cat(categoria), fonteDestinoId: fonte(fonteDestino) };
    const lista = [];
    for (let d = data; d.slice(0, 7) <= ate; d = somarMeses(data, lista.length)) lista.push({ valor, data: d });
    await Lancamento.criar(usuario.id, base, lista, { recorrente: true });
  };
  return lancar;
}

export async function carregarDemonstracao() {
  const ana = await prepararUsuario(
    { nome: 'Ana Souza', email: 'ana@email.com', cpf: '52998224725', senha: 'senha1234' },
    [
      { nome: 'Freelance', tipo: 'renda' },
      { nome: 'Poupança', tipo: 'conta', reserva: true },
      { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 7000 },
      { nome: 'Visa crédito', tipo: 'cartao_credito', diaFechamento: 25, diaVencimento: 5, limite: 8000 },
    ],
  );

  await ana('entrada', 'Saldo inicial da poupança', 9000, dia(4, 2), 'Outras entradas', 'Poupança');

  const variacao = [0, 37.4, -22.1, 58.9];
  for (let m = 3; m >= 0; m--) {
    const v = variacao[m];
    await ana('entrada', 'Salário', 5200, dia(m, 5), 'Salário', 'Conta corrente');
    await ana('entrada', 'Rendimento da poupança', 41.37 + m, dia(m, 28), 'Rendimentos', 'Poupança');
    await ana('saida', 'Aluguel', 1500, dia(m, 10), 'Moradia', 'Conta corrente');
    await ana('saida', 'Condomínio e luz', 312.45 + v, dia(m, 12), 'Moradia', 'Conta corrente');
    await ana('saida', 'Mercado do mês', 612.8 + v * 2, dia(m, 6), 'Alimentação', 'Visa crédito');
    await ana('saida', 'Feira e padaria', 186.5 + v, dia(m, 20), 'Alimentação', 'Carteira');
    await ana('saida', 'iFood', 94.9 + v, dia(m, 16), 'Alimentação', 'Nubank');
    await ana('saida', 'Uber', 128.35 - v, dia(m, 14), 'Mobilidade', 'Visa crédito');
    await ana('saida', 'Combustível', 220, dia(m, 22), 'Mobilidade', 'Nubank');
    await ana('saida', 'Farmácia', 67.9, dia(m, 8), 'Saúde', 'Conta corrente');
    await ana('saida', 'Curso de inglês', 289, dia(m, 15), 'Educação', 'Conta corrente');
    await ana('saida', 'Cinema e bar', 160 + v * 3, dia(m, 24), 'Lazer', 'Visa crédito');
    await ana('saida', 'Aplicação na poupança', 400, dia(m, 6), 'Investimentos', 'Conta corrente');
  }
  await ana('entrada', 'Projeto de site', 1800, dia(3, 18), 'Outras entradas', 'Freelance');
  await ana('entrada', 'Ajuste de layout', 650, dia(1, 19), 'Outras entradas', 'Freelance');
  await ana('saida', 'Consulta dentista', 280, dia(2, 9), 'Saúde', 'Visa crédito');

  await ana('saida', 'Notebook', 4800, dia(2, 15), 'Educação', 'Nubank', 10);
  await ana('saida', 'Geladeira', 2400, dia(1, 26), 'Moradia', 'Visa crédito', 6);
  await ana('saida', 'Tênis de corrida', 360, dia(0, 3), 'Lazer', 'Nubank', 3);
  await ana.mensal('saida', 'Streaming de filmes', 39.9, dia(3, 12), somarMeses(mesAtual, 8).slice(0, 7), 'Lazer', 'Nubank');
  await ana.mensal('saida', 'Academia', 119.9, dia(2, 4), somarMeses(mesAtual, 3).slice(0, 7), 'Saúde', 'Visa crédito');
  await ana('saida', 'Churrasco de aniversário', 540, dia(0, 2), 'Alimentação', 'Conta corrente');

  const bruno = await prepararUsuario(
    { nome: 'Bruno Lima', email: 'bruno@email.com', cpf: '11144477735', senha: 'senha1234' },
    [{ nome: 'Inter', tipo: 'cartao_credito', diaFechamento: 10, diaVencimento: 17, limite: 3000 }],
  );
  for (let m = 3; m >= 0; m--) {
    await bruno('entrada', 'Salário', 3100, dia(m, 1), 'Salário', 'Conta corrente');
    await bruno('saida', 'Aluguel', 1100, dia(m, 5), 'Moradia', 'Conta corrente');
    await bruno('saida', 'Mercado', 480.6, dia(m, 7), 'Alimentação', 'Inter');
    await bruno('saida', 'Academia', 99.9, dia(m, 10), 'Saúde', 'Inter');
    await bruno('saida', 'Show', 230, dia(m, 21), 'Lazer', 'Inter');
  }
  await bruno('saida', 'Celular', 1999, dia(2, 12), 'Outros', 'Inter', 12);

  console.log('Dados de demonstração carregados: ana@email.com e bruno@email.com (senha: senha1234)');
}
