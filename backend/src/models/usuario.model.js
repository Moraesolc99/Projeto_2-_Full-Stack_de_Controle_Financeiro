import { consulta } from '../config/db.js';

// Nunca selecionamos senha_hash fora do login: o hash não sai do model.
const COLUNAS = 'id, nome, email, cpf, criado_em AS "criadoEm"';

export async function criar({ nome, email, cpf, senhaHash }) {
  // A unicidade de e-mail e CPF é garantida pelo banco (UNIQUE). Se repetir, o PostgreSQL
  // lança o erro 23505 e a rota de cadastro o transforma em 409.
  const { rows } = await consulta(
    `INSERT INTO usuarios (nome, email, cpf, senha_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUNAS}`,
    [nome, email, cpf, senhaHash],
  );
  return rows[0];
}

// Só para dar uma mensagem amigável mais cedo; quem garante a unicidade é o UNIQUE do banco.
export async function camposJaUsados({ email, cpf }) {
  const { rows } = await consulta(
    `SELECT EXISTS (SELECT 1 FROM usuarios WHERE email = $1) AS email,
            EXISTS (SELECT 1 FROM usuarios WHERE cpf = $2)   AS cpf`,
    [email, cpf],
  );
  return rows[0];
}

export async function buscarParaLogin(email) {
  const { rows } = await consulta(
    `SELECT ${COLUNAS}, senha_hash AS "senhaHash" FROM usuarios WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function buscarPorId(id) {
  const { rows } = await consulta(`SELECT ${COLUNAS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
