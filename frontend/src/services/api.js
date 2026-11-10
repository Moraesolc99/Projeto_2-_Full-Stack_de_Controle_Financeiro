import axios from 'axios';

const CHAVE_TOKEN = 'financas:token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 15000,
});

export const tokenSalvo = {
  ler: () => localStorage.getItem(CHAVE_TOKEN),
  gravar: (token) => localStorage.setItem(CHAVE_TOKEN, token),
  apagar: () => localStorage.removeItem(CHAVE_TOKEN),
};

let aoExpirarSessao = () => {};
export function definirAoExpirarSessao(fn) {
  aoExpirarSessao = fn;
}

api.interceptors.request.use((config) => {
  const token = tokenSalvo.ler();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    // 401 numa rota protegida = token ausente, inválido ou expirado. Login com senha errada não entra aqui.
    const rotaDeLogin = erro.config?.url?.startsWith('/auth/login');
    if (erro.response?.status === 401 && !rotaDeLogin) aoExpirarSessao();
    return Promise.reject(erro);
  },
);

// Transforma qualquer erro em { mensagem, campos } no formato da API.
export function lerErro(erro) {
  if (erro?.response?.data?.erro) {
    return { mensagem: erro.response.data.erro, campos: erro.response.data.campos ?? {} };
  }
  if (erro?.code === 'ECONNABORTED') return { mensagem: 'O servidor demorou para responder.', campos: {} };
  if (erro?.request && !erro.response) return { mensagem: 'Não foi possível falar com o servidor. Ele está rodando?', campos: {} };
  return { mensagem: 'Algo deu errado. Tente de novo.', campos: {} };
}
