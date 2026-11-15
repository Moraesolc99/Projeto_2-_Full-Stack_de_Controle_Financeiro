// Aplica database/schema.sql no banco apontado por DATABASE_URL.
// É idempotente (CREATE ... IF NOT EXISTS): pode rodar a cada subida sem estragar dados.
//   npm run db:schema
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { conectar, pool, desconectar } from '../src/config/db.js';

const caminho = fileURLToPath(new URL('./schema.sql', import.meta.url));

try {
  await conectar();
  // Sem parâmetros, o driver envia o arquivo inteiro de uma vez (uma única transação implícita).
  await pool.query(await readFile(caminho, 'utf8'));
  console.log('Schema aplicado.');
} catch (erro) {
  console.error('Falha ao aplicar o schema:', erro.message);
  process.exitCode = 1;
} finally {
  await desconectar();
}
