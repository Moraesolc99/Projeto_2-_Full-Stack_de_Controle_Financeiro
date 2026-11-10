import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { lancamentos, relatorios } from '../../services/financas.js';
import { Cabecalho } from '../layout/Layout.jsx';
import { Conteudo, Vazio } from '../ui/Estados.jsx';
import { data, mesAtual, moeda, nomeMes, percentual, periodoDoMes } from '../ui/formatos.js';
import { useCarregar } from '../ui/useCarregar.js';

export function Totais({ totais }) {
  return (
    <div className="totais">
      <div className="total total--entrada">
        <span>Entradas</span>
        <strong>{moeda(totais.entradas)}</strong>
      </div>
      <div className="total total--saida">
        <span>Saídas</span>
        <strong>{moeda(totais.saidas)}</strong>
      </div>
      <div className={`total total--saldo ${totais.saldo < 0 ? 'negativo' : ''}`}>
        <span>Saldo</span>
        <strong>{moeda(totais.saldo)}</strong>
      </div>
    </div>
  );
}

export function BarraLimite({ usado, limite }) {
  const fracao = limite > 0 ? Math.min(usado / limite, 1) : 0;
  const nivel = fracao > 0.85 ? 'alto' : fracao > 0.6 ? 'medio' : 'baixo';
  return (
    <div className="limite" role="meter" aria-valuemin={0} aria-valuemax={limite} aria-valuenow={usado} aria-label="Limite utilizado">
      <div className={`limite__uso limite__uso--${nivel}`} style={{ width: `${fracao * 100}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const mes = mesAtual();
  const periodo = periodoDoMes(mes);

  const resumo = useCarregar(() => Promise.all([
    lancamentos.listar({ ...periodo, porPagina: 6 }),
    relatorios.categorias(periodo),
    relatorios.faturas(1),
  ]), [mes]);

  const [doMes, porCategoria, faturas] = resumo.dados ?? [];
  const maiorCategoria = porCategoria?.categorias[0]?.total ?? 0;

  return (
    <>
      <Cabecalho titulo={`Olá, ${usuario?.nome?.split(' ')[0] ?? ''}`} subtitulo={`Resumo de ${nomeMes(mes)}`}>
        <Link to="/lancamentos" className="botao">Ver lançamentos</Link>
      </Cabecalho>

      <Conteudo {...resumo}>
        {resumo.dados && (
          <>
            <Totais totais={doMes.totais} />

            <div className="grade-painel">
              <section className="cartao">
                <div className="cartao__topo">
                  <h2>Para onde foi o dinheiro</h2>
                  <Link to="/relatorios" className="link">relatório completo</Link>
                </div>
                {porCategoria.categorias.filter((c) => c.total > 0).length === 0 ? (
                  <Vazio titulo="Nenhuma saída este mês" />
                ) : (
                  <ul className="barras">
                    {porCategoria.categorias.filter((c) => c.total > 0).slice(0, 6).map((c) => (
                      <li key={c.id}>
                        <div className="barras__rotulo">
                          <span>{c.nome}</span>
                          <span className="num">{moeda(c.total)} <small>{percentual(c.percentual)}</small></span>
                        </div>
                        <div className="barras__trilho"><div style={{ width: `${(c.total / maiorCategoria) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="cartao">
                <div className="cartao__topo">
                  <h2>Cartões</h2>
                  <Link to="/faturas" className="link">faturas</Link>
                </div>
                {faturas.cartoes.length === 0 ? (
                  <Vazio titulo="Nenhum cartão cadastrado">
                    <Link to="/fontes-destinos" className="link">Cadastrar um cartão</Link>
                  </Vazio>
                ) : (
                  <ul className="lista-cartoes">
                    {faturas.cartoes.map(({ cartao, faturas: lista, limite, limiteUtilizado, limiteDisponivel }) => {
                      const aberta = lista.find((f) => f.situacao === 'aberta');
                      return (
                        <li key={cartao.id}>
                          <div className="lista-cartoes__linha">
                            <strong>{cartao.nome}</strong>
                            <span className="num">{moeda(aberta.total)}</span>
                          </div>
                          <div className="lista-cartoes__linha mudo">
                            <span>Fatura aberta · vence {data(aberta.vencimento)}</span>
                            <span>disponível {moeda(limiteDisponivel)}</span>
                          </div>
                          <BarraLimite usado={limiteUtilizado} limite={limite} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <section className="cartao">
              <div className="cartao__topo">
                <h2>Lançamentos do mês</h2>
                <Link to="/lancamentos" className="link">ver todos</Link>
              </div>
              {doMes.itens.length === 0 ? (
                <Vazio titulo="Nada lançado este mês ainda">
                  <Link to="/lancamentos" className="link">Registrar o primeiro lançamento</Link>
                </Vazio>
              ) : (
                <ul className="ultimos">
                  {doMes.itens.map((l) => (
                    <li key={l.id}>
                      <span className="mudo">{data(l.data)}</span>
                      <span>
                        {l.descricao}
                        {l.totalParcelas > 1 && <span className="etiqueta">{l.parcelaAtual}/{l.totalParcelas}</span>}
                        {l.grupoRecorrencia && <span className="etiqueta etiqueta--mensal">mensal</span>}
                        <small className="mudo"> · {l.categoriaNome}</small>
                      </span>
                      <span className={`num valor--${l.tipo}`}>{l.tipo === 'saida' ? '− ' : '+ '}{moeda(l.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Conteudo>
    </>
  );
}
