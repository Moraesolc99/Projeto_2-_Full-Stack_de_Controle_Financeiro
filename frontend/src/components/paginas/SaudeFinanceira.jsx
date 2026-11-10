import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { saudeFinanceira } from '../../services/financas.js';
import { Cabecalho } from '../layout/Layout.jsx';
import { Conteudo } from '../ui/Estados.jsx';
import { data, moeda, nomeMes, percentual } from '../ui/formatos.js';
import { useCarregar } from '../ui/useCarregar.js';

const ROTULO_NIVEL = { alerta: 'Alerta', atencao: 'Atenção', info: 'Para saber', positivo: 'Bom sinal' };

function Indicador({ titulo, valor, detalhe, tom = 'neutro' }) {
  return (
    <div className={`indicador indicador--${tom}`}>
      <span className="indicador__titulo">{titulo}</span>
      <strong className="indicador__valor">{valor}</strong>
      {detalhe && <span className="indicador__detalhe">{detalhe}</span>}
    </div>
  );
}

function Regra503020({ atual, referencia }) {
  if (!atual) return <p className="mudo">Sem entradas nos últimos 3 meses para comparar.</p>;
  const linhas = [
    { chave: 'necessidade', nome: 'Necessidades' },
    { chave: 'desejo', nome: 'Desejos' },
    { chave: 'poupanca', nome: 'Poupança e investimento' },
  ];
  return (
    <ul className="regra">
      {linhas.map(({ chave, nome }) => {
        const valor = atual[chave];
        const ref = referencia[chave];
        const fora = chave === 'poupanca' ? valor < ref : valor > ref;
        return (
          <li key={chave}>
            <div className="barras__rotulo">
              <span>{nome}</span>
              <span className="num"><strong className={fora ? 'valor--saida' : ''}>{percentual(valor)}</strong> <small className="mudo">ref. {ref}%</small></span>
            </div>
            <div className="regra__trilho">
              <div className={`regra__barra regra__barra--${chave}`} style={{ width: `${Math.min(valor, 100)}%` }} />
              <div className="regra__marca" style={{ left: `${ref}%` }} title={`Referência: ${ref}%`} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function SaudeFinanceira() {
  const analise = useCarregar(() => saudeFinanceira.analisar(), []);
  const a = analise.dados;

  return (
    <>
      <Cabecalho titulo="Saúde financeira" subtitulo="Indicadores, projeção e dicas a partir dos seus próprios lançamentos." />
      <Conteudo {...analise}>
        {a && (() => {
          const { taxaPoupanca, comprometimentoCartoes, parcelasFuturas, regra503020, reserva } = a.indicadores;
          const projecao = [{ mes: 'hoje', saldo: a.projecao.saldoAtual }, ...a.projecao.meses];
          const negativo = projecao.some((p) => p.saldo < 0);
          return (
            <>
              <div className="aviso aviso--info aviso--fixo">{a.aviso}</div>

              <p className="mudo legenda-periodo">
                Base: {data(a.base.inicio)} a {data(a.base.fim)} · renda média {moeda(a.base.rendaMedia)} · gasto médio {moeda(a.base.saidaMedia)}
              </p>

              <div className="indicadores">
                <Indicador
                  titulo="Taxa de poupança"
                  valor={percentual(taxaPoupanca.ultimoMes)}
                  detalhe={`último mês fechado · meta ${taxaPoupanca.referencia}%+`}
                  tom={taxaPoupanca.ultimoMes === null ? 'neutro' : taxaPoupanca.ultimoMes < 0 ? 'ruim' : taxaPoupanca.ultimoMes < taxaPoupanca.referencia ? 'medio' : 'bom'}
                />
                <Indicador
                  titulo="Cartões / renda"
                  valor={percentual(comprometimentoCartoes.percentualDaRenda)}
                  detalhe={`${moeda(comprometimentoCartoes.proximasFaturas)} nas próximas 3 faturas`}
                  tom={comprometimentoCartoes.percentualDaRenda === null ? 'neutro' : comprometimentoCartoes.percentualDaRenda >= comprometimentoCartoes.referencia ? 'ruim' : 'bom'}
                />
                <Indicador
                  titulo="Parcelas a vencer"
                  valor={moeda(parcelasFuturas.total)}
                  detalhe={parcelasFuturas.porMes.length ? `até ${nomeMes(parcelasFuturas.porMes.at(-1).mes)}` : 'nenhuma compra parcelada'}
                />
                <Indicador
                  titulo="Reserva de emergência"
                  valor={reserva.mesesCobertos === null || !reserva.contas.length ? '—' : `${reserva.mesesCobertos.toLocaleString('pt-BR')} meses`}
                  detalhe={reserva.contas.length ? `${moeda(reserva.saldo)} · ref. ${reserva.referencia[0]} a ${reserva.referencia[1]} meses` : 'marque uma conta como reserva'}
                  tom={!reserva.contas.length || reserva.mesesCobertos === null ? 'neutro' : reserva.mesesCobertos < reserva.referencia[0] ? 'medio' : 'bom'}
                />
              </div>

              <div className="grade-painel grade-painel--larga">
                <section className="cartao">
                  <div className="cartao__topo">
                    <h2>Saldo projetado</h2>
                    {negativo && <span className="selo selo--alerta">fica negativo</span>}
                  </div>
                  <p className="mudo pequeno">Média de entradas e gastos à vista dos últimos 3 meses + parcelas já lançadas.</p>
                  <div className="grafico">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={projecao} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid stroke="var(--linha)" vertical={false} />
                        <XAxis dataKey="mes" tickFormatter={(m) => (m === 'hoje' ? 'hoje' : nomeMes(m, true))} stroke="var(--tinta-suave)" fontSize={12} />
                        <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`} stroke="var(--tinta-suave)" fontSize={12} width={60} />
                        <Tooltip formatter={(v) => moeda(v)} labelFormatter={(m) => (m === 'hoje' ? 'Hoje' : nomeMes(m))} />
                        {negativo && <ReferenceLine y={0} stroke="var(--saida)" strokeDasharray="4 4" />}
                        <Line type="monotone" dataKey="saldo" name="Saldo" stroke="var(--marca)" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="cartao">
                  <div className="cartao__topo"><h2>Regra 50/30/20</h2></div>
                  <p className="mudo pequeno">Quanto da renda dos últimos 3 meses foi para cada grupo. A classificação vem das categorias.</p>
                  <Regra503020 {...regra503020} />
                </section>
              </div>

              <section className="cartao">
                <div className="cartao__topo"><h2>Dicas</h2></div>
                <ul className="dicas">
                  {a.dicas.map((d) => (
                    <li key={d.texto} className={`dica dica--${d.nivel}`}>
                      <span className="dica__nivel">{ROTULO_NIVEL[d.nivel]}</span>
                      <p>{d.texto}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          );
        })()}
      </Conteudo>
    </>
  );
}
