import { memoria, proximoId, violacaoUnica } from '../config/db.js';

const semSenha = ({ senhaHash, ...usuario }) => usuario;

export async function criar({ nome, email, cpf, senhaHash }) {
  if (memoria.usuarios.some((u) => u.email === email)) throw violacaoUnica('usuarios_email_key');
  if (memoria.usuarios.some((u) => u.cpf === cpf)) throw violacaoUnica('usuarios_cpf_key');

  const usuario = { id: proximoId('usuarios'), nome, email, cpf, senhaHash, criadoEm: new Date().toISOString() };
  memoria.usuarios.push(usuario);
  return semSenha(usuario);
}

export async function camposJaUsados({ email, cpf }) {
  return {
    email: memoria.usuarios.some((u) => u.email === email),
    cpf: memoria.usuarios.some((u) => u.cpf === cpf),
  };
}

export async function buscarParaLogin(email) {
  const usuario = memoria.usuarios.find((u) => u.email === email);
  return usuario ? { ...usuario } : null;
}

export async function buscarPorId(id) {
  const usuario = memoria.usuarios.find((u) => u.id === id);
  return usuario ? semSenha(usuario) : null;
}
