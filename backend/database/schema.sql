-- =====================================================================
-- Caderneta — Controle financeiro pessoal (Projeto 2)
-- Schema do banco PostgreSQL (16+)
--
-- Roda sozinho na primeira vez que o container do Postgres sobe
-- (docker-entrypoint-initdb.d). Também pode ser aplicado à mão:
--   psql "$DATABASE_URL" -f backend/database/schema.sql
-- =====================================================================

-- Dinheiro é sempre NUMERIC (nunca float): em JS, 0.1 + 0.2 !== 0.3.

CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL UNIQUE,   -- constraint: usuarios_email_key
  cpf         CHAR(11)     NOT NULL UNIQUE,   -- constraint: usuarios_cpf_key
  senha_hash  VARCHAR(100) NOT NULL,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- A unicidade só vale de verdade se o dado estiver normalizado.
  -- A API já normaliza; estes CHECKs impedem que alguém grave fora do padrão.
  CONSTRAINT usuarios_email_minusculo CHECK (email = LOWER(email)),
  CONSTRAINT usuarios_cpf_so_digitos  CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE TABLE IF NOT EXISTS categorias (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id    INTEGER     NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nome          VARCHAR(60) NOT NULL,
  tipo          VARCHAR(7)  NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  -- Usada na regra 50/30/20 da saúde financeira (só faz sentido para saídas).
  classificacao VARCHAR(12) CHECK (classificacao IN ('necessidade', 'desejo', 'poupanca')),

  -- Necessário para a FK composta de lancamentos (garante que a categoria é do mesmo dono).
  CONSTRAINT categorias_id_usuario_uq UNIQUE (id, usuario_id)
);

-- Nome único por usuário e tipo, ignorando maiúsculas ("Lazer" = "lazer").
CREATE UNIQUE INDEX IF NOT EXISTS categorias_usuario_tipo_nome_uq
  ON categorias (usuario_id, tipo, LOWER(nome));

CREATE TABLE IF NOT EXISTS fontes_destinos (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id      INTEGER       NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nome            VARCHAR(60)   NOT NULL,
  tipo            VARCHAR(14)   NOT NULL CHECK (tipo IN ('renda', 'conta', 'cartao_credito')),
  dia_fechamento  SMALLINT      CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento  SMALLINT      CHECK (dia_vencimento BETWEEN 1 AND 31),
  limite          NUMERIC(12,2) CHECK (limite > 0),
  -- Conta marcada como reserva de emergência (indicador da saúde financeira).
  reserva         BOOLEAN       NOT NULL DEFAULT FALSE,

  CONSTRAINT fontes_destinos_id_usuario_uq UNIQUE (id, usuario_id),

  -- Cartão de crédito exige fechamento, vencimento e limite.
  CONSTRAINT fontes_destinos_cartao_completo CHECK (
    tipo <> 'cartao_credito'
    OR (dia_fechamento IS NOT NULL AND dia_vencimento IS NOT NULL AND limite IS NOT NULL)
  ),
  -- Só conta pode ser reserva.
  CONSTRAINT fontes_destinos_reserva_so_conta CHECK (NOT reserva OR tipo = 'conta')
);

CREATE UNIQUE INDEX IF NOT EXISTS fontes_destinos_usuario_nome_uq
  ON fontes_destinos (usuario_id, LOWER(nome));

CREATE TABLE IF NOT EXISTS lancamentos (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id          INTEGER       NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  tipo                VARCHAR(7)    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao           VARCHAR(120)  NOT NULL,
  valor               NUMERIC(12,2) NOT NULL CHECK (valor > 0),     -- o sinal vem do tipo
  data                DATE          NOT NULL,                       -- data em que a parcela/mês cai
  data_compra         DATE          NOT NULL,                       -- data original da compra (base da fatura)
  categoria_id        INTEGER       NOT NULL,
  fonte_destino_id    INTEGER       NOT NULL,
  parcela_atual       SMALLINT      NOT NULL DEFAULT 1,
  total_parcelas      SMALLINT      NOT NULL DEFAULT 1 CHECK (total_parcelas BETWEEN 1 AND 48),
  grupo_parcelamento  UUID,                                         -- igual em todas as parcelas de uma compra
  grupo_recorrencia   UUID,                                         -- igual em todos os meses de uma recorrência
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT lancamentos_parcela_valida CHECK (parcela_atual BETWEEN 1 AND total_parcelas),

  -- FK composta: a categoria e a fonte/destino precisam ser do MESMO usuário do lançamento.
  -- Mesmo que a API erre, o banco não deixa gravar dado cruzado entre usuários (RF3).
  -- Sem ON DELETE: excluir categoria/fonte com lançamentos é bloqueado (erro 23503 → 409 na API).
  CONSTRAINT lancamentos_categoria_fkey
    FOREIGN KEY (categoria_id, usuario_id) REFERENCES categorias (id, usuario_id),
  CONSTRAINT lancamentos_fonte_destino_fkey
    FOREIGN KEY (fonte_destino_id, usuario_id) REFERENCES fontes_destinos (id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_data  ON lancamentos (usuario_id, data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria     ON lancamentos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_fonte_destino ON lancamentos (fonte_destino_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_grupo_parc    ON lancamentos (grupo_parcelamento) WHERE grupo_parcelamento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lancamentos_grupo_recor   ON lancamentos (grupo_recorrencia)   WHERE grupo_recorrencia   IS NOT NULL;
