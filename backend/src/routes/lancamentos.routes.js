import { Router } from 'express';
import * as Lancamento from '../models/lancamento.model.js';
import * as Categoria from '../models/categoria.model.js';
import * as FonteDestino from '../models/fonteDestino.model.js';
import { transacao } from '../config/db.js';
import { dadosInvalidos, naoEncontrado, ErroApi } from '../config/erros.js';
import {
  dividirEmParcelas, somarMeses, somarDias, deCentavos, paraCentavos,
} from '../models/regras.js';
import {
  validarId, validarLancamento, validarPeriodo, validarFiltrosLancamentos,
} from '../middlewares/validar.js';

const router = Router();

const FONTES_PERMITIDAS = { entrada: ['renda', 'conta'], saida: ['conta', 'cartao_credito'] };

const semDono = ({ usuarioId, ...resto }) => resto;

async function conferirRelacionamentos(usuarioId, dados) {
  const [categoria, fonte] = await Promise.all([
    Categoria.buscar(usuarioId, dados.categoriaId),
    FonteDestino.buscar(usuarioId, dados.fonteDestinoId),
  ]);

  const naoAchou = {};
  if (!categoria) naoAchou.categoriaId = 'Categoria não encontrada.';
  if (!fonte) naoAchou.fonteDestinoId = 'Fonte/destino não encontrado.';
  if (Object.keys(naoAchou).length) throw new ErroApi(404, 'Registro relacionado não encontrado.', naoAchou);

  const campos = {};
  if (categoria.tipo !== dados.tipo) {
    campos.categoriaId = `A categoria informada é de ${categoria.tipo === 'entrada' ? 'entrada' : 'saída'}, mas o lançamento é de ${dados.tipo === 'entrada' ? 'entrada' : 'saída'}.`;
  }
  if (!FONTES_PERMITIDAS[dados.tipo].includes(fonte.tipo)) {
    campos.fonteDestinoId = dados.tipo === 'entrada'
      ? 'Uma entrada precisa vir de uma renda ou conta.'
      : 'Uma saída precisa sair de uma conta ou cartão de crédito.';
  }
  if (dados.parcelas > 1 && fonte.tipo !== 'cartao_credito') {
    campos.parcelas = 'Só compras no cartão de crédito podem ser parceladas.';
  }
  if (Object.keys(campos).length) throw dadosInvalidos(campos);

  return { categoria, fonte };
}

router.get('/', validarPeriodo, validarFiltrosLancamentos, async (req, res) => {
  const { pagina, porPagina } = req.paginacao;
  const [{ itens, total }, totais] = await Promise.all([
    Lancamento.listar(req.usuarioId, req.filtros, req.paginacao),
    Lancamento.totais(req.usuarioId, req.filtros),
  ]);
  res.json({
    periodo: req.periodo,
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    totais: { ...totais, saldo: deCentavos(paraCentavos(totais.entradas) - paraCentavos(totais.saidas)) },
    itens: itens.map(semDono),
  });
});

router.post('/', validarLancamento, async (req, res) => {
  const dados = req.dados;
  await conferirRelacionamentos(req.usuarioId, dados);

  const recorrente = Boolean(dados.recorrencia);
  const ocorrencias = recorrente
    ? Array.from({ length: dados.recorrencia.meses }, (_, i) => ({ valor: dados.valor, data: somarMeses(dados.data, i) }))
    : dividirEmParcelas(dados.valor, dados.parcelas).map((valor, i) => ({ valor, data: somarMeses(dados.data, i) }));

  const criados = await transacao(() => Lancamento.criar(req.usuarioId, dados, ocorrencias, { recorrente }));
  res.status(201).json({ lancamentos: criados.map(semDono) });
});

router.get('/:id', validarId, async (req, res) => {
  const lancamento = await Lancamento.buscar(req.usuarioId, req.idRecurso);
  if (!lancamento) throw naoEncontrado('Lançamento não encontrado.');
  res.json(semDono(lancamento));
});

router.put('/:id', validarId, validarLancamento, async (req, res) => {
  const atual = await Lancamento.buscar(req.usuarioId, req.idRecurso);
  if (!atual) throw naoEncontrado('Lançamento não encontrado.');

  const dados = { ...req.dados, parcelas: 1 };
  const parcelado = atual.totalParcelas > 1;

  if (parcelado) {
    const campos = {};
    if (dados.tipo !== atual.tipo) campos.tipo = 'Não é possível mudar o tipo de uma compra parcelada.';
    if (dados.fonteDestinoId !== atual.fonteDestinoId) campos.fonteDestinoId = 'Para trocar o cartão, exclua a compra e lance de novo.';
    if (dados.data !== atual.dataCompra) campos.data = 'Para mudar a data, exclua a compra e lance de novo.';
    if (Object.keys(campos).length) throw dadosInvalidos(campos);
  }

  await conferirRelacionamentos(req.usuarioId, dados);

  const alteracoes = {
    tipo: dados.tipo,
    descricao: dados.descricao,
    valor: dados.valor,
    categoriaId: dados.categoriaId,
    fonteDestinoId: dados.fonteDestinoId,
  };
  if (!parcelado) Object.assign(alteracoes, { data: dados.data, dataCompra: dados.data });

  const aplicarSeguintes = req.query.aplicarSeguintes === 'true' && atual.grupoRecorrencia;

  const atualizado = await transacao(async () => {
    if (aplicarSeguintes) {
      const { data, dataCompra, ...semData } = alteracoes;
      await Lancamento.atualizarRecorrencia(req.usuarioId, atual.grupoRecorrencia, somarDias(atual.data, 1), semData);
    }
    return Lancamento.atualizar(req.usuarioId, req.idRecurso, alteracoes);
  });
  res.json(semDono(atualizado));
});

router.delete('/:id', validarId, async (req, res) => {
  const lancamento = await Lancamento.buscar(req.usuarioId, req.idRecurso);
  if (!lancamento) throw naoEncontrado('Lançamento não encontrado.');

  const { recorrencia } = req.query;
  if (req.query.todasParcelas === 'true' && lancamento.grupoParcelamento) {
    await Lancamento.excluirGrupo(req.usuarioId, lancamento.grupoParcelamento);
  } else if (recorrencia === 'seguintes' && lancamento.grupoRecorrencia) {
    await Lancamento.excluirRecorrencia(req.usuarioId, lancamento.grupoRecorrencia, lancamento.data);
  } else if (recorrencia === 'todas' && lancamento.grupoRecorrencia) {
    await Lancamento.excluirRecorrencia(req.usuarioId, lancamento.grupoRecorrencia);
  } else {
    await Lancamento.excluir(req.usuarioId, req.idRecurso);
  }
  res.status(204).end();
});

export default router;
