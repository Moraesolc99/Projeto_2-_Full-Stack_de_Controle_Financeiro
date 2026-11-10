import { Router } from 'express';
import { analisar } from '../models/saude.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await analisar(req.usuarioId));
});

export default router;
