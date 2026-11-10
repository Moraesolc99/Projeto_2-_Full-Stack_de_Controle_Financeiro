import { useState } from 'react';
import { Link } from 'react-router-dom';
import { relatorios } from '../../services/financas.js';
import { Cabecalho } from '../layout/Layout.jsx';
import { Conteudo, Vazio } from '../ui/Estados.jsx';
import { data, moeda, nomeMes } from '../ui/formatos.js';
import { useCarregar } from '../ui/useCarregar.js';
import { BarraLimite } from './Dashboard.jsx';

const SITUACAO = { fechada: 'Fechada', aberta: 'Aberta', futura: 'Prevista' };

function Fatura({ fatura }) {
  const [aberta, setAberta] = useState(fatura.itens.length > 0);
  return (
    <article className={`fatura fatura--${fatura.situacao}`}>
      <button type="button" className="fatura__topo" onClick={() => setAberta(!aberta)} aria-expanded={aberta}>
        <div>
          <span className={`selo selo--${fatura.situacao}`}>{SITUACAO[fatura.situacao]}</span>
          <h3>{nomeMes(fatura.referencia)}</h3>
          <small className="mudo bloco">Fecha em {data(fatura.fechamento)}</small>
          <small className="mudo bloco">Vence em {data(fatura.vencimento)}</small>
        </div>
        <strong className="num">{moeda(fatura.total)}</strong>
      </button>
      {aberta && (fatura.itens.length === 0 ? <p className="mudo fatura__vazia">Nenhum lançamento nesta fatura.</p> : (
        <ul className="fatura__itens">
          {fatura.itens.map((item) => (
            <li key={item.id}>
              <span>
                {item.descricao}
                {item.totalParcelas > 1 && <span className="etiqueta">{item.parcelaAtual}/{item.totalParcelas}</span>}
                {item.recorrente && <span className="etiqueta etiqueta--mensal">mensal</span>}
                <small className="mudo bloco">compra em {data(item.dataCompra)} · {item.categoria}</small>
              </span>
              <span className="num">{moeda(item.valor)}</span>
            </li>
          ))}
        </ul>
      ))}
    </article>
  );
}

export default function Faturas() {
  const [meses, setMeses] = useState(3);
  const consulta = useCarregar(() => relatorios.faturas(meses), [meses]);

  return (
    <>
      <Cabecalho titulo="Faturas" subtitulo="Fatura aberta e as próximas, já com as parcelas futuras.">
        <label className="seletor-inline">
          Próximas
          <select value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            {[3, 6, 12].map((n) => <option key={n} value={n}>{n} faturas</option>)}
          </select>
        </label>
      </Cabecalho>

      <Conteudo {...consulta}>
        {consulta.dados && (consulta.dados.cartoes.length === 0 ? (
          <Vazio titulo="Você ainda não tem cartões">
            <Link to="/fontes-destinos" className="link">Cadastre um cartão de crédito</Link> para ver as faturas aqui.
          </Vazio>
        ) : consulta.dados.cartoes.map(({ cartao, faturas, limite, limiteUtilizado, limiteDisponivel }) => (
          <section key={cartao.id} className="cartao cartao-credito">
            <div className="cartao-credito__topo">
              <div>
                <h2>{cartao.nome}</h2>
                <small className="mudo">Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</small>
              </div>
              <div className="cartao-credito__limite">
                <div className="lista-cartoes__linha">
                  <span>Usado <strong className="num">{moeda(limiteUtilizado)}</strong></span>
                  <span>Disponível <strong className={`num ${limiteDisponivel < 0 ? 'valor--saida' : ''}`}>{moeda(limiteDisponivel)}</strong></span>
                </div>
                <BarraLimite usado={limiteUtilizado} limite={limite} />
                <small className="mudo">Limite total {moeda(limite)} · considera as parcelas ainda não vencidas; mensalidades futuras só entram quando cobradas</small>
              </div>
            </div>
            <div className="faturas">
              {faturas.map((f) => <Fatura key={f.referencia} fatura={f} />)}
            </div>
          </section>
        )))}
      </Conteudo>
    </>
  );
}
