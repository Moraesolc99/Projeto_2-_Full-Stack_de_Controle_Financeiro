import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { relatorios } from '../../services/financas.js';
import { Cabecalho } from '../layout/Layout.jsx';
import { Conteudo, Vazio } from '../ui/Estados.jsx';
import { FiltroPeriodo } from '../ui/FiltroPeriodo.jsx';
import { data, mesAtual, moeda, NOMES_TIPO_FONTE, percentual, periodoDoMes } from '../ui/formatos.js';
import { useCarregar } from '../ui/useCarregar.js';

export const CORES = ['#1f5c46', '#c2603a', '#d4a24c', '#3f7fa6', '#8a5a9e', '#6f9a5e', '#b3446c', '#7a8794', '#a07b4f', '#2f8f8a'];

const moedaCurta = (v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${v}`);

// Em saídas, subir é ruim (vermelho); em entradas, subir é bom.
function Variacao({ atual, anterior, entrada = false }) {
  if (!anterior && !atual) return <span className="mudo">—</span>;
  if (!anterior) return <span className="variacao variacao--nova">novo</span>;
  const diferenca = atual - anterior;
  if (Math.abs(diferenca) < 0.01) return <span className="mudo">igual</span>;
  const pct = (diferenca / anterior) * 100;
  return (
    <span className={`variacao ${(diferenca > 0) !== entrada ? 'variacao--ruim' : 'variacao--boa'}`}>
      {diferenca > 0 ? '▲' : '▼'} {percentual(Math.abs(pct))}
    </span>
  );
}

function PorCategoria({ periodo }) {
  const relatorio = useCarregar(() => relatorios.categorias(periodo), [periodo.inicio, periodo.fim]);
  const r = relatorio.dados;
  const comSaida = r?.categorias.filter((c) => c.total > 0) ?? [];

  return (
    <Conteudo {...relatorio}>
      {r && (
        <>
          <p className="mudo legenda-periodo">
            Comparando com {data(r.periodoAnterior.inicio)} a {data(r.periodoAnterior.fim)}
          </p>
          <div className="grade-painel grade-painel--relatorio">
            <section className="cartao">
              <div className="cartao__topo">
                <h2>Saídas por categoria</h2>
                <strong className="num">{moeda(r.totalSaidas)}</strong>
              </div>
              {comSaida.length === 0 ? <Vazio titulo="Nenhuma saída no período" /> : (
                <div className="grafico">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={comSaida} dataKey="total" nameKey="nome" innerRadius="55%" outerRadius="85%" paddingAngle={1.5} stroke="none">
                        {comSaida.map((c, i) => <Cell key={c.id} fill={CORES[i % CORES.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => moeda(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="cartao cartao--tabela">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th className="num">Total</th>
                    <th className="num">%</th>
                    <th className="num">Anterior</th>
                    <th className="num">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {r.categorias.map((c) => {
                    const cor = comSaida.findIndex((x) => x.id === c.id);
                    return (
                      <tr key={c.id}>
                        <td className="nome-categoria">
                          <span className="ponto" style={{ background: cor >= 0 ? CORES[cor % CORES.length] : 'transparent' }} />
                          {c.nome}
                        </td>
                        <td className="num">{moeda(c.total)}</td>
                        <td className="num mudo">{percentual(c.percentual)}</td>
                        <td className="num mudo">{moeda(c.periodoAnterior)}</td>
                        <td className="num"><Variacao atual={c.total} anterior={c.periodoAnterior} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{moeda(r.totalSaidas)}</td>
                    <td />
                    <td className="num mudo">{moeda(r.totalSaidasAnterior)}</td>
                    <td className="num"><Variacao atual={r.totalSaidas} anterior={r.totalSaidasAnterior} /></td>
                  </tr>
                </tfoot>
              </table>
            </section>
          </div>

          <section className="cartao cartao--tabela">
            <div className="cartao__topo cartao__topo--tabela">
              <h2>Entradas por categoria</h2>
              <strong className="num valor--entrada">{moeda(r.totalEntradas)}</strong>
            </div>
            {r.entradas.length === 0 ? <Vazio titulo="Nenhuma entrada no período" /> : (
              <table className="tabela">
                <thead>
                  <tr><th>Categoria</th><th className="num">Total</th><th className="num">%</th><th className="num">Anterior</th><th className="num">Variação</th></tr>
                </thead>
                <tbody>
                  {r.entradas.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td className="num">{moeda(c.total)}</td>
                      <td className="num mudo">{percentual(c.percentual)}</td>
                      <td className="num mudo">{moeda(c.periodoAnterior)}</td>
                      <td className="num"><Variacao atual={c.total} anterior={c.periodoAnterior} entrada /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </Conteudo>
  );
}

function PorFonteDestino({ periodo }) {
  const relatorio = useCarregar(() => relatorios.fontesDestinos(periodo), [periodo.inicio, periodo.fim]);
  const r = relatorio.dados;

  const grafico = r ? [
    ...r.fontes.map((f) => ({ nome: f.nome, entradas: f.total, saidas: 0 })),
    ...r.destinos.map((d) => ({ nome: d.nome, entradas: 0, saidas: d.total })),
  ].reduce((lista, item) => {
    const existente = lista.find((x) => x.nome === item.nome);
    if (existente) { existente.entradas += item.entradas; existente.saidas += item.saidas; } else lista.push(item);
    return lista;
  }, []) : [];

  function Tabela({ titulo, linhas, total, classe }) {
    return (
      <section className="cartao cartao--tabela">
        <div className="cartao__topo cartao__topo--tabela">
          <h2>{titulo}</h2>
          <strong className={`num ${classe}`}>{moeda(total)}</strong>
        </div>
        {linhas.length === 0 ? <Vazio titulo="Nada no período" /> : (
          <table className="tabela">
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td>{l.nome} <small className="mudo">{NOMES_TIPO_FONTE[l.tipo]}</small></td>
                  <td className="num">{moeda(l.total)}</td>
                  <td className="num mudo">{percentual((l.total / total) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  return (
    <Conteudo {...relatorio}>
      {r && (
        <>
          <section className="cartao">
            <div className="cartao__topo"><h2>Entradas e saídas por fonte/destino</h2></div>
            {grafico.length === 0 ? <Vazio titulo="Nenhuma movimentação no período" /> : (
              <div className="grafico">
                <ResponsiveContainer width="100%" height={Math.max(220, grafico.length * 44)}>
                  <BarChart data={grafico} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid horizontal={false} stroke="var(--linha)" />
                    <XAxis type="number" tickFormatter={moedaCurta} stroke="var(--tinta-suave)" fontSize={12} />
                    <YAxis type="category" dataKey="nome" width={120} stroke="var(--tinta-suave)" fontSize={13} />
                    <Tooltip formatter={(v) => moeda(v)} cursor={{ fill: 'var(--fundo-sutil)' }} />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="var(--entrada)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="var(--saida)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
          <div className="grade-painel">
            <Tabela titulo="Entradas por fonte" linhas={r.fontes} total={r.totalEntradas} classe="valor--entrada" />
            <Tabela titulo="Saídas por destino" linhas={r.destinos} total={r.totalSaidas} classe="valor--saida" />
          </div>
          <section className="cartao cartao--tabela">
            <div className="cartao__topo cartao__topo--tabela"><h2>Saldo das contas no período</h2></div>
            {r.contas.length === 0 ? <Vazio titulo="Nenhuma conta cadastrada" /> : (
              <table className="tabela">
                <thead><tr><th>Conta</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Saldo</th></tr></thead>
                <tbody>
                  {r.contas.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td className="num valor--entrada">{moeda(c.entradas)}</td>
                      <td className="num valor--saida">{moeda(c.saidas)}</td>
                      <td className={`num forte ${c.saldo < 0 ? 'valor--saida' : ''}`}>{moeda(c.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </Conteudo>
  );
}

export default function Relatorios() {
  const [aba, setAba] = useState('categorias');
  const [periodo, setPeriodo] = useState(() => periodoDoMes(mesAtual()));

  return (
    <>
      <Cabecalho titulo="Relatórios" subtitulo="Totais calculados no servidor para o período escolhido." />
      <div className="barra-filtros">
        <div className="abas" role="tablist">
          <button type="button" role="tab" aria-selected={aba === 'categorias'} className={aba === 'categorias' ? 'ativa' : ''} onClick={() => setAba('categorias')}>Por categoria</button>
          <button type="button" role="tab" aria-selected={aba === 'fontes'} className={aba === 'fontes' ? 'ativa' : ''} onClick={() => setAba('fontes')}>Por fonte/destino</button>
        </div>
        <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} />
      </div>
      {aba === 'categorias' ? <PorCategoria periodo={periodo} /> : <PorFonteDestino periodo={periodo} />}
    </>
  );
}
