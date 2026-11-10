import { Router } from 'express';
import * as Categoria from '../models/categoria.model.js';
import { conflito, naoEncontrado, restricaoUnicaViolada, chaveEstrangeiraViolada } from '../config/erros.js';
import { validarCategoria, validarId } from '../middlewares/validar.js';

const router = Router();

function conflitoDeNome(erro) {
  if (restricaoUnicaViolada(erro) !== null) {
    return conflito('Categoria já existe.', { nome: 'Você já tem uma categoria com este nome para este tipo.' });
  }
  return erro;
}

router.get('/', async (req, res) => {
  const tipo = ['entrada', 'saida'].includes(req.query.tipo) ? req.query.tipo : undefined;
  res.json(await Categoria.listar(req.usuarioId, tipo));
});

router.post('/', validarCategoria, async (req, res) => {
  try {
    res.status(201).json(await Categoria.criar(req.usuarioId, req.dados));
  } catch (erro) {
    throw conflitoDeNome(erro);
  }
});

router.put('/:id', validarId, validarCategoria, async (req, res) => {
  const atual = await Categoria.buscar(req.usuarioId, req.idRecurso);
  if (!atual) throw naoEncontrado('Categoria não encontrada.');

  if (atual.tipo !== req.dados.tipo && await Categoria.contarLancamentos(req.usuarioId, req.idRecurso) > 0) {
    throw conflito('Não é possível mudar o tipo.', {
      tipo: 'Esta categoria já tem lançamentos. Crie outra categoria para o novo tipo.',
    });
  }
  try {
    res.json(await Categoria.atualizar(req.usuarioId, req.idRecurso, req.dados));
  } catch (erro) {
    throw conflitoDeNome(erro);
  }
});

router.delete('/:id', validarId, async (req, res) => {
  const categoria = await Categoria.buscar(req.usuarioId, req.idRecurso);
  if (!categoria) throw naoEncontrado('Categoria não encontrada.');

  const emUso = await Categoria.contarLancamentos(req.usuarioId, req.idRecurso);
  if (emUso > 0) {
    throw conflito(`A categoria "${categoria.nome}" tem ${emUso} lançamento(s) e não pode ser excluída. Mova ou exclua esses lançamentos antes.`);
  }
  try {
    await Categoria.excluir(req.usuarioId, req.idRecurso);
  } catch (erro) {
    if (chaveEstrangeiraViolada(erro)) throw conflito('A categoria passou a ter lançamentos e não pode ser excluída.');
    throw erro;
  }
  res.status(204).end();
});

export default router;
