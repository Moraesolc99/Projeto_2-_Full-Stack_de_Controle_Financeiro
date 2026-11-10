import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { conectar, modoBanco } from './config/db.js';
import { autenticar } from './middlewares/autenticar.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import authRoutes from './routes/auth.routes.js';
import categoriasRoutes from './routes/categorias.routes.js';
import fontesDestinosRoutes from './routes/fontesDestinos.routes.js';
import lancamentosRoutes from './routes/lancamentos.routes.js';
import relatoriosRoutes from './routes/relatorios.routes.js';
import saudeRoutes from './routes/saude.routes.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: config.origemFrontend }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/status', (req, res) => res.json({ ok: true, modoBanco }));

app.use('/api/auth', authRoutes);
app.use('/api/categorias', autenticar, categoriasRoutes);
app.use('/api/fontes-destinos', autenticar, fontesDestinosRoutes);
app.use('/api/lancamentos', autenticar, lancamentosRoutes);
app.use('/api/relatorios', autenticar, relatoriosRoutes);
app.use('/api/saude-financeira', autenticar, saudeRoutes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

async function iniciar() {
  await conectar();
  if (modoBanco === 'memoria') {
    const { carregarDemonstracao } = await import('../database/seed-memoria.js');
    await carregarDemonstracao();
  }
  app.listen(config.porta, () => {
    console.log(`API rodando em http://localhost:${config.porta} (modo: ${modoBanco})`);
  });
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar a API:', erro.message);
  process.exit(1);
});
