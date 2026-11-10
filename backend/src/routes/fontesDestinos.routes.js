import { Router } from 'express';
import * as FonteDestino from '../models/fonteDestino.model.js';
import { conflito, naoEncontrado, restricaoUnicaViolada, chaveEstrangeiraViolada } from '../config/erros.js';
import { validarFonteDestino, validarId } from '../middlewares/validar.js';

const router = Router();

function conflitoDeNome(erro) {
  if (restricaoUnicaViolada(erro) !== null) {
    return conflito('Fonte/destino já existe.', { nome: 'Você já tem uma fonte/destino com este nome.' });
  }
  return erro;
}

router.get('/', async (req, res) => {
  const tipo = ['renda', 'conta', 'cartao_credito'].includes(req.query.tipo) ? req.query.tipo : undefined;
  res.json(await FonteDestino.listar(req.usuarioId, tipo));
});

router.post('/', validarFonteDestino, async (req, res) => {
  try {
    res.status(201).json(await FonteDestino.criar(req.usuarioId, req.dados));
  } catch (erro) {
    throw conflitoDeNome(erro);
  }
});

router.put('/:id', validarId, validarFonteDestino, async (req, res) => {
  const atual = await FonteDestino.buscar(req.usuarioId, req.idRecurso);
  if (!atual) throw naoEncontrado('Fonte/destino não encontrado.');

  if (atual.tipo !== req.dados.tipo && await FonteDestino.contarLancamentos(req.usuarioId, req.idRecurso) > 0) {
    throw conflito('Não é possível mudar o tipo.', {
      tipo: 'Já existem lançamentos aqui. Crie um novo cadastro para o outro tipo.',
    });
  }
  try {
    res.json(await FonteDestino.atualizar(req.usuarioId, req.idRecurso, req.dados));
  } catch (erro) {
    throw conflitoDeNome(erro);
  }
});

router.delete('/:id', validarId, async (req, res) => {
  const fonte = await FonteDestino.buscar(req.usuarioId, req.idRecurso);
  if (!fonte) throw naoEncontrado('Fonte/destino não encontrado.');

  const emUso = await FonteDestino.contarLancamentos(req.usuarioId, req.idRecurso);
  if (emUso > 0) {
    throw conflito(`"${fonte.nome}" tem ${emUso} lançamento(s) e não pode ser excluído. Mova ou exclua esses lançamentos antes.`);
  }
  try {
    await FonteDestino.excluir(req.usuarioId, req.idRecurso);
  } catch (erro) {
    if (chaveEstrangeiraViolada(erro)) throw conflito('Este cadastro passou a ter lançamentos e não pode ser excluído.');
    throw erro;
  }
  res.status(204).end();
});

export default router;
