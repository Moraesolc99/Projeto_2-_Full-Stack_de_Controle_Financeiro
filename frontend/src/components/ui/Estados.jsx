export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className="estado" aria-busy="true">
      <span className="estado__girador" />
      <p>{texto}</p>
    </div>
  );
}

export function Vazio({ titulo, children }) {
  return (
    <div className="estado estado--vazio">
      <p className="estado__titulo">{titulo}</p>
      {children && <div className="estado__texto">{children}</div>}
    </div>
  );
}

export function ErroTela({ mensagem, aoTentarDeNovo }) {
  return (
    <div className="estado estado--erro" role="alert">
      <p className="estado__titulo">Não deu para carregar</p>
      <p className="estado__texto">{mensagem}</p>
      {aoTentarDeNovo && <button type="button" className="botao botao--secundario" onClick={aoTentarDeNovo}>Tentar de novo</button>}
    </div>
  );
}

// Envolve o conteúdo de uma tela: mostra carregando/erro e só depois os filhos.
export function Conteudo({ carregando, erro, recarregar, dados, children }) {
  if (erro) return <ErroTela mensagem={erro} aoTentarDeNovo={recarregar} />;
  if (carregando && !dados) return <Carregando />;
  return <div className={carregando ? 'atualizando' : undefined}>{children}</div>;
}

export function Aviso({ tipo = 'erro', children }) {
  if (!children) return null;
  return <div className={`aviso aviso--${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>{children}</div>;
}
