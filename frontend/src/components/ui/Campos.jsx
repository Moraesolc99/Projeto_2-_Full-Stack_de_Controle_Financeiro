import { useId } from 'react';

export function Campo({ rotulo, erro, ajuda, children, className = '' }) {
  return (
    <div className={`campo ${erro ? 'campo--erro' : ''} ${className}`}>
      {rotulo && (typeof rotulo === 'string' ? <span className="campo__rotulo">{rotulo}</span> : rotulo)}
      {children}
      {erro ? <span className="campo__erro" role="alert">{erro}</span> : ajuda && <span className="campo__ajuda">{ajuda}</span>}
    </div>
  );
}

export function Entrada({ rotulo, erro, ajuda, className, ...props }) {
  const id = useId();
  return (
    <Campo rotulo={rotulo && <label htmlFor={id}>{rotulo}</label>} erro={erro} ajuda={ajuda} className={className}>
      <input id={id} aria-invalid={Boolean(erro)} {...props} />
    </Campo>
  );
}

export function Selecao({ rotulo, erro, ajuda, children, className, ...props }) {
  const id = useId();
  return (
    <Campo rotulo={rotulo && <label htmlFor={id}>{rotulo}</label>} erro={erro} ajuda={ajuda} className={className}>
      <select id={id} aria-invalid={Boolean(erro)} {...props}>{children}</select>
    </Campo>
  );
}

// Digita só números e o campo vai montando os centavos: 1 → 0,01 · 1234 → 12,34
export function EntradaMoeda({ valor, aoMudar, ...props }) {
  const texto = valor === '' || valor === null || valor === undefined
    ? ''
    : Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function mudar(evento) {
    const digitos = evento.target.value.replace(/\D/g, '').slice(0, 12);
    aoMudar(digitos ? Number(digitos) / 100 : '');
  }

  return <Entrada inputMode="numeric" placeholder="0,00" value={texto} onChange={mudar} {...props} />;
}
