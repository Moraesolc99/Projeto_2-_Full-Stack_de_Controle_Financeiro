import { config } from './env.js';

/*
 * BD: este arquivo é o ponto de conexão com o banco.
 *
 * Hoje ele expõe um armazenamento em memória para o projeto rodar sem banco.
 * Quando o banco estiver pronto, aqui deve ser criado o pool de conexões
 * (ex.: new pg.Pool({ connectionString: config.databaseUrl })) e exportado
 * junto com uma função transacao(fn) que faça BEGIN / COMMIT / ROLLBACK.
 * Os models passam a usar o pool no lugar de `memoria`.
 * Detalhes em docs/BANCO-DE-DADOS.md.
 */

export const modoBanco = config.modoBanco;

export const memoria = {
  usuarios: [],
  categorias: [],
  fontes_destinos: [],
  lancamentos: [],
};

const sequencias = { usuarios: 0, categorias: 0, fontes_destinos: 0, lancamentos: 0 };

export function proximoId(tabela) {
  sequencias[tabela] += 1;
  return sequencias[tabela];
}

// Imita o erro que o banco lança quando uma restrição UNIQUE é violada.
export function violacaoUnica(nomeRestricao) {
  const erro = new Error(`Violação de unicidade: ${nomeRestricao}`);
  erro.code = 'UNIQUE_MEMORIA';
  erro.constraint = nomeRestricao;
  return erro;
}

export function violacaoChaveEstrangeira(nomeRestricao) {
  const erro = new Error(`Registro referenciado: ${nomeRestricao}`);
  erro.code = 'FK_MEMORIA';
  erro.constraint = nomeRestricao;
  return erro;
}

// Tudo ou nada: se algo falhar no meio, os dados voltam ao estado anterior.
export async function transacao(fn) {
  const copiaDados = structuredClone(memoria);
  const copiaSeq = { ...sequencias };
  try {
    return await fn();
  } catch (erro) {
    for (const tabela of Object.keys(memoria)) memoria[tabela] = copiaDados[tabela];
    Object.assign(sequencias, copiaSeq);
    throw erro;
  }
}

export async function conectar() {
  if (modoBanco === 'memoria') return;
  // BD: abrir o pool e testar a conexão (ex.: await pool.query('SELECT 1')).
  throw new Error('MODO_BANCO=banco, mas a conexão ainda não foi implementada em src/config/db.js.');
}
