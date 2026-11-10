import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { lerErro } from '../../services/api.js';
import { Entrada } from '../ui/Campos.jsx';
import { Aviso } from '../ui/Estados.jsx';
import { cpfValido, mascaraCpf } from '../ui/formatos.js';
import { TelaAcesso } from './Login.jsx';

function validar(form) {
  const erros = {};
  if (form.nome.trim().length < 2) erros.nome = 'Informe seu nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) erros.email = 'E-mail inválido.';
  if (!cpfValido(form.cpf)) erros.cpf = 'CPF inválido.';
  if (form.senha.length < 8 || !/[A-Za-z]/.test(form.senha) || !/\d/.test(form.senha)) {
    erros.senha = 'Mínimo de 8 caracteres, com letras e números.';
  }
  if (form.confirmacaoSenha !== form.senha) erros.confirmacaoSenha = 'As senhas não conferem.';
  return erros;
}

export default function Cadastro() {
  const { cadastrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', cpf: '', senha: '', confirmacaoSenha: '' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo, transformar = (v) => v) => (e) => {
    setForm({ ...form, [campo]: transformar(e.target.value) });
    if (erros[campo]) setErros({ ...erros, [campo]: undefined });
  };

  async function enviar(e) {
    e.preventDefault();
    const novosErros = validar(form);
    setErros(novosErros);
    setMensagem('');
    if (Object.keys(novosErros).length) return;

    setEnviando(true);
    try {
      await cadastrar({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      navigate('/', { replace: true });
    } catch (erro) {
      // O servidor diz qual campo está duplicado; a mensagem vai para baixo do campo certo.
      const { mensagem: texto, campos } = lerErro(erro);
      setErros(campos);
      setMensagem(Object.keys(campos).length ? '' : texto);
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Criar conta" subtitulo="Já criamos categorias e uma conta corrente para você começar.">
      <Aviso>{mensagem}</Aviso>
      <form onSubmit={enviar} noValidate>
        <Entrada rotulo="Nome" value={form.nome} onChange={mudar('nome')} erro={erros.nome} autoComplete="name" autoFocus />
        <Entrada rotulo="E-mail" type="email" value={form.email} onChange={mudar('email')} erro={erros.email} autoComplete="email" />
        <Entrada rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={mudar('cpf', mascaraCpf)} erro={erros.cpf} />
        <div className="grade-2">
          <Entrada rotulo="Senha" type="password" value={form.senha} onChange={mudar('senha')} erro={erros.senha} autoComplete="new-password" />
          <Entrada rotulo="Confirme a senha" type="password" value={form.confirmacaoSenha} onChange={mudar('confirmacaoSenha')} erro={erros.confirmacaoSenha} autoComplete="new-password" />
        </div>
        <button type="submit" className="botao botao--largo" disabled={enviando}>{enviando ? 'Criando conta…' : 'Criar conta'}</button>
      </form>
      <p className="acesso__troca">Já tem conta? <Link to="/login">Entrar</Link></p>
    </TelaAcesso>
  );
}
