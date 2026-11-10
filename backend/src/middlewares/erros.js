import { ErroApi } from '../config/erros.js';

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

export function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroApi) {
    const corpo = { erro: erro.message };
    if (erro.campos) corpo.campos = erro.campos;
    return res.status(erro.status).json(corpo);
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Requisição grande demais.' });
  }
  console.error(erro);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
