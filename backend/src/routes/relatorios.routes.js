import { Router } from 'express';
import * as Relatorio from '../models/relatorio.model.js';
import * as FonteDestino from '../models/fonteDestino.model.js';
import * as Lancamento from '../models/lancamento.model.js';
import { dadosInvalidos } from '../config/erros.js';
import { validarPeriodo } from '../middlewares/validar.js';
import {
  periodoAnterior, percentual, somar, montarFaturas, deCentavos, paraCentavos,
} from '../models/regras.js';

const router = Router();

router.get('/categorias', validarPeriodo, async (req, res) => {
  const { inicio, fim } = req.periodo;
  const anterior = periodoAnterior(inicio, fim);

  const [saidas, entradas, saidasAntes, entradasAntes] = await Promise.all([
    Relatorio.somarPorCategoria(req.usuarioId, 'saida', inicio, fim),
    Relatorio.somarPorCategoria(req.usuarioId, 'entrada', inicio, fim),
    Relatorio.somarPorCategoria(req.usuarioId, 'saida', anterior.inicio, anterior.fim),
    Relatorio.somarPorCategoria(req.usuarioId, 'entrada', anterior.inicio, anterior.fim),
  ]);

  const totalSaidas = somar(saidas.map((c) => c.total));
  const totalEntradas = somar(entradas.map((c) => c.total));

  function comparar(atual, antes, total) {
    const ids = new Set([...atual.map((c) => c.id), ...antes.map((c) => c.id)]);
    return [...ids].map((id) => {
      const agora = atual.find((c) => c.id === id);
      const antigo = antes.find((c) => c.id === id);
      const valor = agora?.total ?? 0;
      const valorAnterior = antigo?.total ?? 0;
      return {
        id,
        nome: (agora ?? antigo).nome,
        total: valor,
        percentual: percentual(valor, total),
        periodoAnterior: valorAnterior,
        variacao: deCentavos(paraCentavos(valor) - paraCentavos(valorAnterior)),
        variacaoPercentual: valorAnterior > 0 ? percentual(valor - valorAnterior, valorAnterior) : null,
      };
    }).sort((a, b) => b.total - a.total || b.periodoAnterior - a.periodoAnterior);
  }

  res.json({
    periodo: { inicio, fim },
    periodoAnterior: anterior,
    totalSaidas,
    totalSaidasAnterior: somar(saidasAntes.map((c) => c.total)),
    totalEntradas,
    totalEntradasAnterior: somar(entradasAntes.map((c) => c.total)),
    categorias: comparar(saidas, saidasAntes, totalSaidas),
    entradas: comparar(entradas, entradasAntes, totalEntradas),
  });
});

router.get('/fontes-destinos', validarPeriodo, async (req, res) => {
  const { inicio, fim } = req.periodo;
  const linhas = await Relatorio.somarPorFonteDestino(req.usuarioId, inicio, fim);

  const fontes = linhas.filter((l) => l.entradas > 0)
    .map(({ id, nome, tipo, entradas }) => ({ id, nome, tipo, total: entradas }))
    .sort((a, b) => b.total - a.total);
  const destinos = linhas.filter((l) => l.saidas > 0)
    .map(({ id, nome, tipo, saidas }) => ({ id, nome, tipo, total: saidas }))
    .sort((a, b) => b.total - a.total);
  const contas = linhas.filter((l) => l.tipo === 'conta')
    .map((l) => ({ ...l, saldo: deCentavos(paraCentavos(l.entradas) - paraCentavos(l.saidas)) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  res.json({
    periodo: { inicio, fim },
    totalEntradas: somar(fontes.map((f) => f.total)),
    totalSaidas: somar(destinos.map((d) => d.total)),
    fontes,
    destinos,
    contas,
  });
});

router.get('/faturas', async (req, res) => {
  const meses = req.query.meses === undefined ? 3 : Number(req.query.meses);
  if (!Number.isInteger(meses) || meses < 1 || meses > 12) {
    throw dadosInvalidos({ meses: 'Informe de 1 a 12 meses.' });
  }

  const cartoes = await FonteDestino.listar(req.usuarioId, 'cartao_credito');
  const resultado = await Promise.all(cartoes.map(async (cartao) => {
    const lancamentos = await Lancamento.listarDoCartao(req.usuarioId, cartao.id);
    return {
      cartao: {
        id: cartao.id,
        nome: cartao.nome,
        diaFechamento: cartao.diaFechamento,
        diaVencimento: cartao.diaVencimento,
      },
      ...montarFaturas(cartao, lancamentos, meses),
    };
  }));

  res.json({ cartoes: resultado });
});

export default router;
