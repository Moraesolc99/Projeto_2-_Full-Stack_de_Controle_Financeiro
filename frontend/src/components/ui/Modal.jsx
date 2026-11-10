import { useEffect } from 'react';

export function Modal({ titulo, aberto, aoFechar, children, largura = 520 }) {
  useEffect(() => {
    if (!aberto) return undefined;
    const fecharComEsc = (e) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', fecharComEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', fecharComEsc);
      document.body.style.overflow = '';
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="modal__fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: largura }}>
        <header className="modal__topo">
          <h2>{titulo}</h2>
          <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Confirmar({ aberto, titulo, mensagem, acoes, aoFechar, erro }) {
  return (
    <Modal titulo={titulo} aberto={aberto} aoFechar={aoFechar} largura={440}>
      <div className="modal__corpo">
        <p>{mensagem}</p>
        {erro && <div className="aviso aviso--erro">{erro}</div>}
      </div>
      <footer className="modal__rodape">
        <button type="button" className="botao botao--secundario" onClick={aoFechar}>Cancelar</button>
        {acoes}
      </footer>
    </Modal>
  );
}
