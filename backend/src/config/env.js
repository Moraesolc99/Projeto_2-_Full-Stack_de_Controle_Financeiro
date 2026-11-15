import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const producao = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'troque-este-segredo') {
  if (producao) {
    throw new Error('Defina um JWT_SECRET de verdade no .env antes de rodar em produção.');
  }
  console.warn('[aviso] JWT_SECRET não definido; usando um segredo temporário (quem estava logado precisa entrar de novo).');
}

export const config = {
  porta: Number(process.env.PORT) || 3000,
  origemFrontend: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSegredo: process.env.JWT_SECRET && process.env.JWT_SECRET !== 'troque-este-segredo'
    ? process.env.JWT_SECRET
    : randomBytes(32).toString('hex'),
  jwtExpiraEm: process.env.JWT_EXPIRA_EM || '1h',
  limiteTentativasLogin: Number(process.env.LOGIN_MAX_TENTATIVAS) || 10,
  databaseUrl: process.env.DATABASE_URL || '',
  poolMaximo: Number(process.env.DB_POOL_MAX) || 10,
};
