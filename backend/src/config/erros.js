export class ErroApi extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

export const dadosInvalidos = (campos, mensagem = 'Dados inválidos.') => new ErroApi(400, mensagem, campos);
export const naoEncontrado = (mensagem = 'Registro não encontrado.') => new ErroApi(404, mensagem);
export const conflito = (mensagem, campos) => new ErroApi(409, mensagem, campos);

// Devolve o nome da restrição UNIQUE violada, venha o erro de qual banco vier.
// Assim as rotas não precisam saber qual SGBD está por trás.
export function restricaoUnicaViolada(erro) {
  if (!erro) return null;
  if (erro.code === 'UNIQUE_MEMORIA') return erro.constraint;
  if (erro.code === '23505') return erro.constraint ?? '';            // PostgreSQL
  if (erro.code === 'ER_DUP_ENTRY') return erro.sqlMessage ?? '';      // MySQL
  if (erro.code === 11000) return Object.keys(erro.keyPattern ?? {}).join('_'); // MongoDB
  return null;
}

export function chaveEstrangeiraViolada(erro) {
  return ['23503', 'ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2', 'FK_MEMORIA'].includes(erro?.code);
}
