import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { config } from './env.js';

// O driver devolve DATE como objeto Date e NUMERIC como string.
// A API trabalha com datas 'AAAA-MM-DD' e valores numéricos, então convertemos aqui, num só lugar.
pg.types.setTypeParser(1082, (valor) => valor);          // DATE    -> 'AAAA-MM-DD'
pg.types.setTypeParser(1700, (valor) => parseFloat(valor)); // NUMERIC -> number (NUMERIC(12,2) cabe com folga num double)
pg.types.setTypeParser(20, (valor) => parseInt(valor, 10)); // BIGINT (COUNT) -> number

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL não definida. Ex.: postgres://financas:financas@localhost:5432/financas');
}

// Pool de conexões: reaproveita conexões abertas em vez de abrir uma por requisição.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.poolMaximo,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (erro) => console.error('Erro numa conexão ociosa do pool:', erro.message));

// Guarda, para a requisição em andamento, a conexão que está dentro de uma transação.
// É o que permite os models chamarem `consulta()` sem saber se há transação aberta.
const transacaoAtual = new AsyncLocalStorage();

/** Executa SQL parametrizado ($1, $2...). Dentro de `transacao()` usa a conexão da transação; fora, o pool. */
export function consulta(sql, parametros = []) {
  const cliente = transacaoAtual.getStore() ?? pool;
  return cliente.query(sql, parametros);
}

/**
 * Executa `fn` numa transação: tudo é gravado (COMMIT) ou nada é (ROLLBACK).
 * Todas as chamadas a `consulta()` feitas dentro de `fn` — mesmo em outras funções — usam a mesma conexão.
 */
export async function transacao(fn) {
  if (transacaoAtual.getStore()) return fn(); // já dentro de uma transação: participa dela

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await transacaoAtual.run(cliente, fn);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally {
    cliente.release();
  }
}

/** Confirma que o banco responde. Tenta algumas vezes porque o Postgres pode ainda estar subindo. */
export async function conectar({ tentativas = 30, esperaMs = 1000 } = {}) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (erro) {
      if (i === tentativas) throw new Error(`Não foi possível conectar ao banco: ${erro.message}`);
      console.log(`Aguardando o banco (${i}/${tentativas})...`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}

export async function desconectar() {
  await pool.end();
}
