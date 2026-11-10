import { useState } from 'react';
import { lerErro } from '../../services/api.js';
import { fontesDestinos } from '../../services/financas.js';
import { Cabecalho } from '../layout/Layout.jsx';
import { Entrada, EntradaMoeda, Selecao } from '../ui/Campos.jsx';
import { Aviso, Conteudo, Vazio } from '../ui/Estados.jsx';
import { Confirmar, Modal } from '../ui/Modal.jsx';
import { moeda, NOMES_TIPO_FONTE } from '../ui/formatos.js';
import { useCarregar } from '../ui/useCarregar.js';

const DESCRICAO_TIPO = {
  renda: 'De onde o dinheiro vem: salário, freelance, aluguel recebido…',
  conta: 'Onde o dinheiro fica: conta corrente, poupança, carteira…',
  cartao_credito: 'Compras no crédito, que viram fatura.',
};

function FormFonte({ fonte, tipoInicial, aoSalvar, aoCancelar }) {
  const [form, setForm] = useState({
    nome: fonte?.nome ?? '',
    tipo: fonte?.tipo ?? tipoInicial,
    diaFechamento: fonte?.diaFechamento ?? '',
    diaVencimento: fonte?.diaVencimento ?? '',
    limite: fonte?.limite ?? '',
    reserva: fonte?.reserva ?? false,
  });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const cartao = form.tipo === 'cartao_credito';

  const mudar = (campo, valor) => {
    setForm({ ...form, [campo]: valor });
    if (erros[campo]) setErros({ ...erros, [campo]: undefined });
  };

  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Informe o nome.';
    if (cartao) {
      const dia = (v) => Number.isInteger(Number(v)) && v !== '' && Number(v) >= 1 && Number(v) <= 31;
      if (!dia(form.diaFechamento)) e.diaFechamento = 'Dia entre 1 e 31.';
      if (!dia(form.diaVencimento)) e.diaVencimento = 'Dia entre 1 e 31.';
      if (!(Number(form.limite) > 0)) e.limite = 'Informe o limite.';
    }
    return e;
  }

  async function salvar(evento) {
    evento.preventDefault();
    const e = validar();
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    const corpo = cartao
      ? { nome: form.nome.trim(), tipo: form.tipo, diaFechamento: Number(form.diaFechamento), diaVencimento: Number(form.diaVencimento), limite: Number(form.limite) }
      : { nome: form.nome.trim(), tipo: form.tipo, reserva: form.tipo === 'conta' && form.reserva };
    try {
      if (fonte) await fontesDestinos.atualizar(fonte.id, corpo);
      else await fontesDestinos.criar(corpo);
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
        <Entrada rotulo="Nome" value={form.nome} maxLength={60} autoFocus erro={erros.nome} onChange={(e) => mudar('nome', e.target.value)} />
        <Selecao rotulo="Tipo" value={form.tipo} erro={erros.tipo} ajuda={DESCRICAO_TIPO[form.tipo]} onChange={(e) => mudar('tipo', e.target.value)}>
          {Object.entries(NOMES_TIPO_FONTE).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </Selecao>
        {cartao && (
          <>
            <div className="grade-2">
              <Entrada rotulo="Dia do fechamento" type="number" min={1} max={31} value={form.diaFechamento} erro={erros.diaFechamento}
                onChange={(e) => mudar('diaFechamento', e.target.value)} />
              <Entrada rotulo="Dia do vencimento" type="number" min={1} max={31} value={form.diaVencimento} erro={erros.diaVencimento}
                onChange={(e) => mudar('diaVencimento', e.target.value)} />
            </div>
            <EntradaMoeda rotulo="Limite (R$)" valor={form.limite} erro={erros.limite} aoMudar={(v) => mudar('limite', v)} />
          </>
        )}
        {form.tipo === 'conta' && (
          <label className="caixa">
            <input type="checkbox" checked={form.reserva} onChange={(e) => mudar('reserva', e.target.checked)} />
            Esta conta é minha reserva de emergência
          </label>
        )}
      </div>
      <footer className="modal__rodape">
        <button type="button" className="botao botao--secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </footer>
    </form>
  );
}

export default function FontesDestinos() {
  const lista = useCarregar(() => fontesDestinos.listar(), []);
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');

  async function excluir() {
    try {
      await fontesDestinos.excluir(excluindo.id);
      setExcluindo(null);
      lista.recarregar();
    } catch (erro) {
      setErroExclusao(lerErro(erro).mensagem);
    }
  }

  return (
    <>
      <Cabecalho titulo="Fontes e destinos" subtitulo="De onde o dinheiro vem e por onde ele sai." />
      <Conteudo {...lista}>
        {lista.dados && (
          <div className="grade-3">
            {Object.entries(NOMES_TIPO_FONTE).map(([tipo, titulo]) => {
              const doTipo = lista.dados.filter((f) => f.tipo === tipo);
              return (
                <section key={tipo} className="cartao">
                  <div className="cartao__topo">
                    <h2>{titulo === 'Renda' ? 'Rendas' : titulo === 'Conta' ? 'Contas' : 'Cartões'}</h2>
                    <button type="button" className="link" onClick={() => setEditando({ novo: true, tipo })}>+ novo</button>
                  </div>
                  {doTipo.length === 0 ? <Vazio titulo="Nada cadastrado">{DESCRICAO_TIPO[tipo]}</Vazio> : (
                    <ul className="lista-simples">
                      {doTipo.map((f) => (
                        <li key={f.id}>
                          <span>
                            {f.nome}
                            {f.reserva && <span className="etiqueta etiqueta--poupanca">reserva</span>}
                            {f.tipo === 'cartao_credito' && (
                              <small className="mudo bloco">
                                fecha dia {f.diaFechamento} · vence dia {f.diaVencimento} · limite {moeda(f.limite)}
                              </small>
                            )}
                          </span>
                          <span className="tabela__acoes">
                            <button type="button" className="link" onClick={() => setEditando(f)}>editar</button>
                            <button type="button" className="link link--perigo" onClick={() => { setErroExclusao(''); setExcluindo(f); }}>excluir</button>
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

      <Modal titulo={editando?.novo ? 'Novo cadastro' : 'Editar'} aberto={Boolean(editando)} aoFechar={() => setEditando(null)} largura={460}>
        {editando && (
          <FormFonte
            fonte={editando.novo ? null : editando}
            tipoInicial={editando.tipo}
            aoCancelar={() => setEditando(null)}
            aoSalvar={() => { setEditando(null); lista.recarregar(); }}
          />
        )}
      </Modal>

      <Confirmar
        aberto={Boolean(excluindo)}
        titulo="Excluir"
        mensagem={excluindo && `Excluir "${excluindo.nome}"?`}
        erro={erroExclusao}
        aoFechar={() => setExcluindo(null)}
        acoes={<button type="button" className="botao botao--perigo" onClick={excluir}>Excluir</button>}
      />
    </>
  );
}
