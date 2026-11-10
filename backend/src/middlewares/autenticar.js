import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function autenticar(req, res, next) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSegredo);
    // O id sempre vem do token. Numérico para SQL; se o banco for MongoDB, fica como texto (ObjectId).
    req.usuarioId = /^\d+$/.test(payload.sub) ? Number(payload.sub) : payload.sub;
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

export function gerarToken(usuario) {
  return jwt.sign({ nome: usuario.nome }, config.jwtSegredo, {
    subject: String(usuario.id),
    expiresIn: config.jwtExpiraEm,
  });
}
