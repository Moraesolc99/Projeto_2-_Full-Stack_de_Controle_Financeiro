import { useState } from 'react';
import { lerErro } from '../../services/api.js';
import { categorias } from '../../services/financas.js';
import { Cabecalho } from '../layout/Layout.jsx';
import { Entrada, Selecao } from '../ui/Campos.jsx';
import { Aviso, Conteudo, Vazio } from '../ui/Estados.jsx';
import { Confirmar, Modal } from '../ui/Modal.jsx';
import { NOMES_CLASSIFICACAO } from '../ui/formatos.js';
import { useCarregar } from '../ui/useCarregar.js';

function FormCategoria({ categoria, tipoInicial, aoSalvar, aoCancelar }) {
  const [form, setForm] = useState({
    nome: categoria?.nome ?? '',
    tipo: categoria?.tipo ?? tipoInicial,
    classificacao: categoria?.classificacao ?? '',
  });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome.trim()) return setErros({ nome: 'Informe o nome.' });
    setSalvando(true);
    try {
      const corpo = { ...form, nome: form.nome.trim(), classificacao: form.tipo === 'saida' ? form.classificacao || null : null };
      if (categoria) await categorias.atualizar(categoria.id, corpo);
      else await categorias.criar(corpo);
      aoSalvar();
    } catch (erro) {
      const { mensagem: texto, campos } = lerErro(erro);
      setErros(campos);
      setMensagem(Object.keys(campos).length ? '' : texto);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate>
      <div className="modal__corpo">
        <Aviso>{mensagem}</Aviso>
        <Entrada rotulo="Nome" value={form.nome} maxLength={60} autoFocus erro={erros.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <Selecao rotulo="Tipo" value={form.tipo} erro={erros.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          <option value="saida">Saída</option>
          <option value="entrada">Entrada</option>
        </Selecao>
        {form.tipo === 'saida' && (
          <Selecao
            rotulo="Classificação (regra 50/30/20)"
            value={form.classificacao}
            erro={erros.classificacao}
            ajuda="Usada na página de saúde financeira."
            onChange={(e) => setForm({ ...form, classificacao: e.target.value })}
          >
            <option value="">Sem classificação</option>
            {Object.entries(NOMES_CLASSIFICACAO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </Selecao>
        )}
      </div>
      <footer className="modal__rodape">
        <button type="button" className="botao botao--secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </footer>
    </form>
  );
}

export default function Categorias() {
  const lista = useCarregar(() => categorias.listar(), []);
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');

  async function excluir() {
    try {
      await categorias.excluir(excluindo.id);
      setExcluindo(null);
      lista.recarregar();
    } catch (erro) {
      setErroExclusao(lerErro(erro).mensagem);
    }
  }

  const grupos = [
    { tipo: 'saida', titulo: 'Saídas' },
    { tipo: 'entrada', titulo: 'Entradas' },
  ];

  return (
    <>
      <Cabecalho titulo="Categorias" subtitulo="Como você classifica o que entra e o que sai." />
      <Conteudo {...lista}>
        {lista.dados && (
          <div className="grade-painel">
            {grupos.map(({ tipo, titulo }) => {
              const doTipo = lista.dados.filter((c) => c.tipo === tipo);
              return (
                <section key={tipo} className="cartao">
                  <div className="cartao__topo">
                    <h2>{titulo}</h2>
                    <button type="button" className="link" onClick={() => setEditando({ novo: true, tipo })}>+ nova</button>
                  </div>
                  {doTipo.length === 0 ? <Vazio titulo="Nenhuma categoria" /> : (
                    <ul className="lista-simples">
                      {doTipo.map((c) => (
                        <li key={c.id}>
                          <span>
                            {c.nome}
                            {c.classificacao && <span className={`etiqueta etiqueta--${c.classificacao}`}>{NOMES_CLASSIFICACAO[c.classificacao]}</span>}
                          </span>
                          <span className="tabela__acoes">
                            <button type="button" className="link" onClick={() => setEditando(c)}>editar</button>
                            <button type="button" className="link link--perigo" onClick={() => { setErroExclusao(''); setExcluindo(c); }}>excluir</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Conteudo>

      <Modal titulo={editando?.novo ? 'Nova categoria' : 'Editar categoria'} aberto={Boolean(editando)} aoFechar={() => setEditando(null)} largura={440}>
        {editando && (
          <FormCategoria
            categoria={editando.novo ? null : editando}
            tipoInicial={editando.tipo}
            aoCancelar={() => setEditando(null)}
            aoSalvar={() => { setEditando(null); lista.recarregar(); }}
          />
        )}
      </Modal>

      <Confirmar
        aberto={Boolean(excluindo)}
        titulo="Excluir categoria"
        mensagem={excluindo && `Excluir a categoria "${excluindo.nome}"?`}
        erro={erroExclusao}
        aoFechar={() => setExcluindo(null)}
        acoes={<button type="button" className="botao botao--perigo" onClick={excluir}>Excluir</button>}
      />
    </>
  );
}
