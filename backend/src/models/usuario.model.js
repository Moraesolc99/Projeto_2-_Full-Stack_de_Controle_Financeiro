import { memoria, proximoId, violacaoUnica } from '../config/db.js';

const semSenha = ({ senhaHash, ...usuario }) => usuario;

export async function criar({ nome, email, cpf, senhaHash }) {
  // BD: INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ($1, $2, $3, $4)
  //     RETURNING id, nome, email, cpf, criado_em
  //     Quem barra e-mail/CPF repetido é o UNIQUE do banco: deixe o erro subir para a rota tratar.
  if (memoria.usuarios.some((u) => u.email === email)) throw violacaoUnica('usuarios_email_key');
  if (memoria.usuarios.some((u) => u.cpf === cpf)) throw violacaoUnica('usuarios_cpf_key');

  const usuario = { id: proximoId('usuarios'), nome, email, cpf, senhaHash, criadoEm: new Date().toISOString() };
  memoria.usuarios.push(usuario);
  return semSenha(usuario);
}

// Só serve para mensagem amigável antes de tentar gravar. Não é ela que garante a unicidade.
export async function camposJaUsados({ email, cpf }) {
  // BD: SELECT email, cpf FROM usuarios WHERE email = $1 OR cpf = $2
  return {
    email: memoria.usuarios.some((u) => u.email === email),
    cpf: memoria.usuarios.some((u) => u.cpf === cpf),
  };
}

// Único método que devolve o hash, usado apenas no login.
export async function buscarParaLogin(email) {
  // BD: SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1
  const usuario = memoria.usuarios.find((u) => u.email === email);
  return usuario ? { ...usuario } : null;
}

export async function buscarPorId(id) {
  // BD: SELECT id, nome, email, cpf, criado_em FROM usuarios WHERE id = $1
  const usuario = memoria.usuarios.find((u) => u.id === id);
  return usuario ? semSenha(usuario) : null;
}
