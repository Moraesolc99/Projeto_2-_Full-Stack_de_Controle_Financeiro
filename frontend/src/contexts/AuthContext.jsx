import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { definirAoExpirarSessao, tokenSalvo } from '../services/api.js';
import { auth } from '../services/financas.js';

const AuthContext = createContext(null);

// Lê a data de expiração de dentro do JWT (só leitura; quem valida de verdade é o servidor).
function expiracaoDoToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function tokenAindaValido(token) {
  const expira = token && expiracaoDoToken(token);
  return Boolean(expira && expira > Date.now());
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => {
    const salvo = tokenSalvo.ler();
    return tokenAindaValido(salvo) ? salvo : null;
  });
  const [usuario, setUsuario] = useState(null);
  const [verificando, setVerificando] = useState(Boolean(token));

  const logout = useCallback((motivo) => {
    tokenSalvo.apagar();
    setToken(null);
    setUsuario(null);
    navigate('/login', { replace: true, state: motivo ? { aviso: motivo } : undefined });
  }, [navigate]);

  useEffect(() => {
    definirAoExpirarSessao(() => logout('Sua sessão expirou. Entre novamente.'));
  }, [logout]);

  // Ao abrir a página com um token salvo, confirma com o servidor quem é o usuário.
  useEffect(() => {
    if (!token) {
      tokenSalvo.apagar();
      setVerificando(false);
      return;
    }
    let ativo = true;
    auth.eu()
      .then((dados) => ativo && setUsuario(dados))
      .catch((erro) => {
        // Token de um usuário que não existe mais (ex.: a API reiniciou sem banco): volta para o login.
        if (ativo && erro.response?.status === 404) logout('Sua sessão não é mais válida. Entre novamente.');
      })
      .finally(() => ativo && setVerificando(false));
    return () => { ativo = false; };
  }, [token]);

  // Desloga sozinho quando o token vencer, sem esperar uma requisição falhar.
  useEffect(() => {
    if (!token) return undefined;
    const restante = expiracaoDoToken(token) - Date.now();
    const timer = setTimeout(() => logout('Sua sessão expirou. Entre novamente.'), Math.max(restante, 0));
    return () => clearTimeout(timer);
  }, [token, logout]);

  const login = useCallback(async (email, senha) => {
    const resposta = await auth.login(email, senha);
    tokenSalvo.gravar(resposta.token);
    setUsuario(resposta.usuario);
    setToken(resposta.token);
    return resposta.usuario;
  }, []);

  const cadastrar = useCallback(async ({ nome, email, cpf, senha, confirmacaoSenha }) => {
    await auth.cadastrar({ nome, email, cpf, senha, confirmacaoSenha });
    return login(email, senha);
  }, [login]);

  const valor = useMemo(() => ({
    token, usuario, autenticado: Boolean(token), verificando, login, logout, cadastrar,
  }), [token, usuario, verificando, login, logout, cadastrar]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return contexto;
}
