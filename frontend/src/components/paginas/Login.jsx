import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { lerErro } from '../../services/api.js';
import { Entrada } from '../ui/Campos.jsx';
import { Aviso } from '../ui/Estados.jsx';

export function TelaAcesso({ titulo, subtitulo, children }) {
  return (
    <div className="acesso">
      <section className="acesso__lado">
        <span className="marca__simbolo marca__simbolo--grande">R$</span>
        <h2>Caderneta</h2>
        <p>Entradas, saídas, cartões e parcelas num lugar só. Saiba para onde o dinheiro vai antes que ele vá.</p>
      </section>
      <section className="acesso__form">
        <h1>{titulo}</h1>
        <p className="cabecalho__sub">{subtitulo}</p>
        {children}
      </section>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const local = useLocation();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function entrar(e) {
    e.preventDefault();
    const novosErros = {};
    if (!form.email.trim()) novosErros.email = 'Informe o e-mail.';
    if (!form.senha) novosErros.senha = 'Informe a senha.';
    setErros(novosErros);
    setMensagem('');
    if (Object.keys(novosErros).length) return;

    setEnviando(true);
    try {
      await login(form.email.trim(), form.senha);
      navigate(local.state?.voltarPara ?? '/', { replace: true });
    } catch (erro) {
      const { mensagem: texto, campos } = lerErro(erro);
      setMensagem(texto);
      setErros(campos);
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Entrar" subtitulo="Bem-vindo de volta.">
      {local.state?.aviso && <Aviso tipo="info">{local.state.aviso}</Aviso>}
      <Aviso>{mensagem}</Aviso>
      <form onSubmit={entrar} noValidate>
        <Entrada rotulo="E-mail" type="email" autoComplete="email" value={form.email} onChange={mudar('email')} erro={erros.email} autoFocus />
        <Entrada rotulo="Senha" type="password" autoComplete="current-password" value={form.senha} onChange={mudar('senha')} erro={erros.senha} />
        <button type="submit" className="botao botao--largo" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="acesso__troca">Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </TelaAcesso>
  );
}
