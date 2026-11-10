import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import * as Usuario from '../models/usuario.model.js';
import * as Categoria from '../models/categoria.model.js';
import * as FonteDestino from '../models/fonteDestino.model.js';
import { transacao } from '../config/db.js';
import { config } from '../config/env.js';
import { conflito, naoEncontrado, ErroApi, restricaoUnicaViolada } from '../config/erros.js';
import { autenticar, gerarToken } from '../middlewares/autenticar.js';
import { validarCadastro, validarLogin } from '../middlewares/validar.js';

const router = Router();

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.limiteTentativasLogin,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Tente de novo em alguns minutos.' },
});

// Hash qualquer, só para o login demorar o mesmo tempo quando o e-mail não existe.
const HASH_FALSO = bcrypt.hashSync('nao-existe-123', 10);

const mensagemDuplicado = {
  email: 'Já existe um usuário com este e-mail.',
  cpf: 'Já existe um usuário com este CPF.',
};

router.post('/cadastro', validarCadastro, async (req, res) => {
  const { nome, email, cpf, senha } = req.dados;

  const usados = await Usuario.camposJaUsados({ email, cpf });
  if (usados.email || usados.cpf) {
    const campos = {};
    if (usados.email) campos.email = mensagemDuplicado.email;
    if (usados.cpf) campos.cpf = mensagemDuplicado.cpf;
    throw conflito('Usuário já cadastrado.', campos);
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await transacao(async () => {
      const novo = await Usuario.criar({ nome, email, cpf, senhaHash });
      await Categoria.criarPadrao(novo.id);
      await FonteDestino.criarPadrao(novo.id);
      return novo;
    });
    return res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
  } catch (erro) {
    // A verificação lá em cima pode perder uma corrida; quem decide de verdade é o UNIQUE do banco.
    const restricao = restricaoUnicaViolada(erro);
    if (restricao !== null) {
      const campo = restricao.includes('cpf') ? 'cpf' : 'email';
      throw conflito('Usuário já cadastrado.', { [campo]: mensagemDuplicado[campo] });
    }
    throw erro;
  }
});

router.post('/login', limiteLogin, validarLogin, async (req, res) => {
  const { email, senha } = req.dados;
  const usuario = await Usuario.buscarParaLogin(email);
  const confere = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FALSO);

  if (!usuario || !confere) throw new ErroApi(401, 'E-mail ou senha inválidos.');

  return res.json({
    token: gerarToken(usuario),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
  });
});

router.get('/me', autenticar, async (req, res) => {
  const usuario = await Usuario.buscarPorId(req.usuarioId);
  if (!usuario) throw naoEncontrado('Usuário não encontrado.');
  return res.json(usuario);
});

export default router;
