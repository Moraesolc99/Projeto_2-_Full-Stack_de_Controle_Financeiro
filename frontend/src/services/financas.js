import { api } from './api.js';

const dados = (promessa) => promessa.then((r) => r.data);

export const auth = {
  login: (email, senha) => dados(api.post('/auth/login', { email, senha })),
  cadastrar: (usuario) => dados(api.post('/auth/cadastro', usuario)),
  eu: () => dados(api.get('/auth/me')),
};

export const categorias = {
  listar: (tipo) => dados(api.get('/categorias', { params: { tipo } })),
  criar: (categoria) => dados(api.post('/categorias', categoria)),
  atualizar: (id, categoria) => dados(api.put(`/categorias/${id}`, categoria)),
  excluir: (id) => api.delete(`/categorias/${id}`),
};

export const fontesDestinos = {
  listar: (tipo) => dados(api.get('/fontes-destinos', { params: { tipo } })),
  criar: (fonte) => dados(api.post('/fontes-destinos', fonte)),
  atualizar: (id, fonte) => dados(api.put(`/fontes-destinos/${id}`, fonte)),
  excluir: (id) => api.delete(`/fontes-destinos/${id}`),
};

export const lancamentos = {
  listar: (filtros) => dados(api.get('/lancamentos', { params: filtros })),
  buscar: (id) => dados(api.get(`/lancamentos/${id}`)),
  criar: (lancamento) => dados(api.post('/lancamentos', lancamento)),
  atualizar: (id, lancamento, { aplicarSeguintes = false } = {}) =>
    dados(api.put(`/lancamentos/${id}`, lancamento, { params: aplicarSeguintes ? { aplicarSeguintes: true } : {} })),
  // opcoes: { todasParcelas: true } ou { recorrencia: 'seguintes' | 'todas' }
  excluir: (id, opcoes = {}) => api.delete(`/lancamentos/${id}`, { params: opcoes }),
};

export const relatorios = {
  categorias: (periodo) => dados(api.get('/relatorios/categorias', { params: periodo })),
  fontesDestinos: (periodo) => dados(api.get('/relatorios/fontes-destinos', { params: periodo })),
  faturas: (meses = 3) => dados(api.get('/relatorios/faturas', { params: { meses } })),
};

export const saudeFinanceira = {
  analisar: () => dados(api.get('/saude-financeira')),
};
