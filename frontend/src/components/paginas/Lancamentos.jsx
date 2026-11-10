import { useState } from 'react';
import { lerErro } from '../../services/api.js';
import { categorias as apiCategorias, fontesDestinos, lancamentos } from '../../services/financas.js';
import { Cabecalho } from '../layout/Layout.jsx';
import { Conteudo, Vazio } from '../ui/Estados.jsx';
import { FiltroPeriodo } from '../ui/FiltroPeriodo.jsx';
import { Confirmar, Modal } from '../ui/Modal.jsx';
import { data, mesAtual, moeda, periodoDoMes } from '../ui/formatos.js';
import { useCarregar } from '../ui/useCarregar.js';
import FormLancamento from './FormLancamento.jsx';
import { Totais } from './Dashboard.jsx';

const POR_PAGINA = 15;

export default function Lancamentos() {
  const [periodo, setPeriodo] = useState(() => periodoDoMes(mesAtual()));
  const [filtros, setFiltros] = useState({ tipo: '', categoriaId: '', fonteDestinoId: '' });
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');

  const cadastros = useCarregar(() => Promise.all([apiCategorias.listar(), fontesDestinos.listar()]), []);
  const [listaCategorias = [], listaFontes = []] = cadastros.dados ?? [];

  const consulta = { ...periodo, ...filtros, pagina, porPagina: POR_PAGINA };
  const lista = useCarregar(
    () => lancamentos.listar(Object.fromEntries(Object.entries(consulta).filter(([, v]) => v !== ''))),
    [JSON.stringify(consulta)],
  );

  function mudarFiltro(campo, valor) {
    setFiltros({ ...filtros, [campo]: valor });
    setPagina(1);
  }

  function mudarPeriodo(novo) {
    setPeriodo(novo);
    setPagina(1);
  }

  async function excluir(opcoes) {
    try {
      await lancamentos.excluir(excluindo.id, opcoes);
      setExcluindo(null);
      lista.recarregar();
    } catch (erro) {
      setErroExclusao(lerErro(erro).mensagem);
    }
  }

  const dados = lista.dados;

  return (
    <>
      <Cabecalho titulo="Lançamentos" subtitulo="Tudo o que entrou e saiu no período.">
        <button type="button" className="botao" onClick={() => setEditando('novo')} disabled={!cadastros.dados}>
          + Novo lançamento
        </button>
      </Cabecalho>

      <div className="barra-filtros">
        <FiltroPeriodo periodo={periodo} aoMudar={mudarPeriodo} />
        <div className="barra-filtros__selects">
          <select value={filtros.tipo} onChange={(e) => mudarFiltro('tipo', e.target.value)} aria-label="Tipo">
            <option value="">Entradas e saídas</option>
            <option value="entrada">Só entradas</option>
            <option value="saida">Só saídas</option>
          </select>
          <select value={filtros.categoriaId} onChange={(e) => mudarFiltro('categoriaId', e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {listaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo === 'entrada' ? 'entrada' : 'saída'})</option>)}
          </select>
          <select value={filtros.fonteDestinoId} onChange={(e) => mudarFiltro('fonteDestinoId', e.target.value)} aria-label="Fonte ou destino">
            <option value="">Todas as fontes e destinos</option>
            {listaFontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </div>

      <Conteudo {...lista}>
        {dados && (
          <>
            <Totais totais={dados.totais} />
            {dados.itens.length === 0 ? (
              <Vazio titulo="Nenhum lançamento neste período">Mude o período ou os filtros, ou registre um novo lançamento.</Vazio>
            ) : (
              <div className="cartao cartao--tabela">
                <table className="tabela tabela--lancamentos">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Fonte / destino</th>
                      <th className="num">Valor</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((l) => (
                      <tr key={l.id}>
                        <td className="mudo col-data">{data(l.data)}</td>
                        <td className="col-desc">
                          {l.descricao}
                          {l.totalParcelas > 1 && <span className="etiqueta">{l.parcelaAtual}/{l.totalParcelas}</span>}
                          {l.grupoRecorrencia && <span className="etiqueta etiqueta--mensal" title="Repete todo mês">mensal</span>}
                        </td>
                        <td className="col-cat">{l.categoriaNome}</td>
                        <td className="mudo col-fonte">{l.fonteDestinoNome}</td>
                        <td className={`num col-valor valor--${l.tipo}`}>{l.tipo === 'saida' ? '− ' : '+ '}{moeda(l.valor)}</td>
                        <td className="col-acoes">
                          <div className="tabela__acoes">
                            <button type="button" className="link" onClick={() => setEditando(l)}>editar</button>
                            <button type="button" className="link link--perigo" onClick={() => { setErroExclusao(''); setExcluindo(l); }}>excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dados.totalPaginas > 1 && (
                  <div className="paginacao">
                    <button type="button" className="botao botao--secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                    <span>Página {dados.pagina} de {dados.totalPaginas} · {dados.total} lançamentos</span>
                    <button type="button" className="botao botao--secundario" disabled={pagina >= dados.totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Conteudo>

      <Modal
        titulo={editando === 'novo' ? 'Novo lançamento' : 'Editar lançamento'}
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
      >
        {editando && (
          <FormLancamento
            lancamento={editando === 'novo' ? null : editando}
            categorias={listaCategorias}
            fontes={listaFontes}
            aoCancelar={() => setEditando(null)}
            aoSalvar={() => { setEditando(null); lista.recarregar(); }}
          />
        )}
      </Modal>

      <Confirmar
        aberto={Boolean(excluindo)}
        erro={erroExclusao}
        aoFechar={() => setExcluindo(null)}
        titulo={excluindo?.grupoRecorrencia ? 'Excluir ou encerrar recorrência' : 'Excluir lançamento'}
        mensagem={excluindo && (excluindo.grupoRecorrencia
          ? `"${excluindo.descricao}" se repete todo mês. Você pode apagar só ${data(excluindo.data)}, encerrar a partir dele (os meses anteriores ficam) ou apagar todos os meses.`
          : excluindo.totalParcelas > 1
            ? `"${excluindo.descricao}" é a parcela ${excluindo.parcelaAtual} de ${excluindo.totalParcelas}. Quer excluir só esta parcela ou a compra inteira?`
            : `Excluir "${excluindo.descricao}" de ${moeda(excluindo.valor)}? Não dá para desfazer.`)}
        acoes={excluindo && (excluindo.grupoRecorrencia ? (
          <>
            <button type="button" className="botao botao--perigo-leve" onClick={() => excluir()}>Só este mês</button>
            <button type="button" className="botao botao--perigo-leve" onClick={() => excluir({ recorrencia: 'todas' })}>Todos os meses</button>
            <button type="button" className="botao botao--perigo" onClick={() => excluir({ recorrencia: 'seguintes' })}>Encerrar a partir deste</button>
          </>
        ) : excluindo.totalParcelas > 1 ? (
          <>
            <button type="button" className="botao botao--perigo-leve" onClick={() => excluir()}>Só esta parcela</button>
            <button type="button" className="botao botao--perigo" onClick={() => excluir({ todasParcelas: true })}>Todas as parcelas</button>
          </>
        ) : (
          <button type="button" className="botao botao--perigo" onClick={() => excluir()}>Excluir</button>
        ))}
      />
    </>
  );
}
