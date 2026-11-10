import { useState } from 'react';
import { mesVizinho, nomeMes, periodoDoMes } from './formatos.js';

// Navegação mês a mês, com opção de escolher um intervalo livre.
export function FiltroPeriodo({ periodo, aoMudar }) {
  const referencia = periodo.inicio.slice(0, 7);
  const ehMesInteiro = (() => {
    const mes = periodoDoMes(referencia);
    return mes.inicio === periodo.inicio && mes.fim === periodo.fim;
  })();
  const [livre, setLivre] = useState(!ehMesInteiro);

  if (livre) {
    return (
      <div className="filtro-periodo filtro-periodo--livre">
        <label>
          De
          <input type="date" value={periodo.inicio} max={periodo.fim} onChange={(e) => e.target.value && aoMudar({ ...periodo, inicio: e.target.value })} />
        </label>
        <label>
          até
          <input type="date" value={periodo.fim} min={periodo.inicio} onChange={(e) => e.target.value && aoMudar({ ...periodo, fim: e.target.value })} />
        </label>
        <button type="button" className="link" onClick={() => { setLivre(false); aoMudar(periodoDoMes(referencia)); }}>
          voltar para mês
        </button>
      </div>
    );
  }

  return (
    <div className="filtro-periodo">
      <button type="button" className="botao-icone" aria-label="Mês anterior" onClick={() => aoMudar(periodoDoMes(mesVizinho(referencia, -1)))}>‹</button>
      <span className="filtro-periodo__mes">{nomeMes(referencia)}</span>
      <button type="button" className="botao-icone" aria-label="Próximo mês" onClick={() => aoMudar(periodoDoMes(mesVizinho(referencia, 1)))}>›</button>
      <button type="button" className="link" onClick={() => setLivre(true)}>escolher datas</button>
    </div>
  );
}
