import { useMemo, useState } from 'react';
import { lerErro } from '../../services/api.js';
import { lancamentos } from '../../services/financas.js';
import { Entrada, EntradaMoeda, Selecao } from '../ui/Campos.jsx';
import { Aviso } from '../ui/Estados.jsx';
import { hojeIso, mesVizinho, moeda, nomeMes, NOMES_TIPO_FONTE } from '../ui/formatos.js';

const FONTES_POR_TIPO = { entrada: ['renda', 'conta'], saida: ['conta', 'cartao_credito'] };

function previaParcelas(valor, quantidade) {
  const centavos = Math.round(Number(valor) * 100);
  if (!centavos || quantidade < 2) return null;
  const base = Math.floor(centavos / quantidade);
  const primeira = base + (centavos - base * quantidade);
  return primeira === base
    ? `${quantidade}× de ${moeda(base / 100)}`
    : `1× de ${moeda(primeira / 100)} + ${quantidade - 1}× de ${moeda(base / 100)}`;
}

function mesesEntre(dataIso, ateMes) {
  if (!dataIso || !ateMes) return 0;
  const [ai, mi] = dataIso.split('-').map(Number);
  const [af, mf] = ateMes.split('-').map(Number);
  return (af - ai) * 12 + (mf - mi) + 1;
}

export default function FormLancamento({ lancamento, categorias, fontes, aoSalvar, aoCancelar }) {
  const editando = Boolean(lancamento);
  const parcelado = editando && lancamento.totalParcelas > 1;
  const recorrenteExistente = editando && Boolean(lancamento.grupoRecorrencia);
  const [modo, setModo] = useState('unico');
  const [repetirAte, setRepetirAte] = useState(() => mesVizinho(hojeIso().slice(0, 7), 11));
  const [aplicarSeguintes, setAplicarSeguintes] = useState(false);
  const [form, setForm] = useState(() => ({
    tipo: lancamento?.tipo ?? 'saida',
    descricao: lancamento?.descricao ?? '',
    valor: lancamento?.valor ?? '',
    data: lancamento?.dataCompra ?? hojeIso(),
    categoriaId: lancamento?.categoriaId ?? '',
    fonteDestinoId: lancamento?.fonteDestinoId ?? '',
    parcelas: 2,
  }));
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);

  const categoriasDoTipo = useMemo(() => categorias.filter((c) => c.tipo === form.tipo), [categorias, form.tipo]);
  const fontesDoTipo = useMemo(() => fontes.filter((f) => FONTES_POR_TIPO[form.tipo].includes(f.tipo)), [fontes, form.tipo]);
  const fonteEscolhida = fontes.find((f) => String(f.id) === String(form.fonteDestinoId));
  const podeParcelar = !editando && form.tipo === 'saida' && fonteEscolhida?.tipo === 'cartao_credito';

  function mudar(campo, valor) {
    const novo = { ...form, [campo]: valor };
    if (campo === 'tipo') {
      novo.categoriaId = '';
      novo.fonteDestinoId = '';
      if (modo === 'parcelado') setModo('unico');
    }
    if (campo === 'fonteDestinoId' && modo === 'parcelado'
      && fontes.find((f) => String(f.id) === String(valor))?.tipo !== 'cartao_credito') {
      setModo('unico');
    }
    setForm(novo);
    if (erros[campo]) setErros({ ...erros, [campo]: undefined });
  }

  function validar() {
    const e = {};
    if (!form.descricao.trim()) e.descricao = 'Informe a descrição.';
    if (!(Number(form.valor) > 0)) e.valor = 'O valor deve ser maior que zero.';
    if (!form.data) e.data = 'Informe a data.';
    if (!form.categoriaId) e.categoriaId = 'Escolha uma categoria.';
    if (!form.fonteDestinoId) e.fonteDestinoId = form.tipo === 'entrada' ? 'Escolha a fonte.' : 'Escolha o destino.';
    if (modo === 'parcelado' && !(form.parcelas >= 2 && form.parcelas <= 48)) e.parcelas = 'Entre 2 e 48 parcelas.';
    if (modo === 'mensal') {
      const meses = mesesEntre(form.data, repetirAte);
      if (!repetirAte) e.repetirAte = 'Informe até qual mês repetir.';
      else if (meses < 2) e.repetirAte = 'Escolha um mês depois do mês da data.';
      else if (meses > 60) e.repetirAte = 'No máximo 60 meses.';
    }
    return e;
  }

  async function salvar(evento) {
    evento.preventDefault();
    const e = validar();
    setErros(e);
    setMensagem('');
    if (Object.keys(e).length) return;

    const corpo = {
      ...form,
      descricao: form.descricao.trim(),
      categoriaId: Number(form.categoriaId),
      fonteDestinoId: Number(form.fonteDestinoId),
      parcelas: modo === 'parcelado' ? Number(form.parcelas) : 1,
      ...(modo === 'mensal' ? { recorrente: true, repetirAte } : {}),
    };
    setSalvando(true);
    try {
      if (editando) await lancamentos.atualizar(lancamento.id, corpo, { aplicarSeguintes });
      else await lancamentos.criar(corpo);
      aoSalvar();
    } catch (erro) {
      const { mensagem: texto, campos } = lerErro(erro);
      setErros(campos);
      setMensagem(texto);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate>
      <div className="modal__corpo">
        <Aviso>{mensagem}</Aviso>
        {recorrenteExistente && (
          <Aviso tipo="info">Este lançamento se repete todo mês. As mudanças valem só para este mês, a não ser que você marque a opção no fim do formulário.</Aviso>
        )}
        {parcelado && (
          <Aviso tipo="info">
            Parcela {lancamento.parcelaAtual} de {lancamento.totalParcelas}. Aqui você muda descrição, categoria e o valor desta parcela.
            Para trocar a data ou o cartão, exclua a compra e lance de novo.
          </Aviso>
        )}

        <div className="alternador" role="radiogroup" aria-label="Tipo">
          {['saida', 'entrada'].map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="radio"
              aria-checked={form.tipo === tipo}
              className={`alternador__opcao alternador__opcao--${tipo} ${form.tipo === tipo ? 'ativo' : ''}`}
              onClick={() => mudar('tipo', tipo)}
              disabled={parcelado}
            >
              {tipo === 'saida' ? 'Saída' : 'Entrada'}
            </button>
          ))}
        </div>
        {erros.tipo && <span className="campo__erro">{erros.tipo}</span>}

        <Entrada rotulo="Descrição" value={form.descricao} onChange={(e) => mudar('descricao', e.target.value)} erro={erros.descricao} maxLength={120} autoFocus />
        <div className="grade-2">
          <EntradaMoeda rotulo={parcelado ? 'Valor desta parcela (R$)' : 'Valor (R$)'} valor={form.valor} aoMudar={(v) => mudar('valor', v)} erro={erros.valor} />
          <Entrada
            rotulo={parcelado ? 'Data da compra' : 'Data'}
            type="date"
            value={form.data}
            onChange={(e) => mudar('data', e.target.value)}
            erro={erros.data}
            disabled={parcelado}
          />
        </div>
        <Selecao rotulo="Categoria" value={form.categoriaId} onChange={(e) => mudar('categoriaId', e.target.value)} erro={erros.categoriaId}>
          <option value="">Escolha…</option>
          {categoriasDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Selecao>
        <Selecao
          rotulo={form.tipo === 'entrada' ? 'Fonte (de onde veio)' : 'Destino (de onde saiu)'}
          value={form.fonteDestinoId}
          onChange={(e) => mudar('fonteDestinoId', e.target.value)}
          erro={erros.fonteDestinoId}
          disabled={parcelado}
        >
          <option value="">Escolha…</option>
          {Object.keys(NOMES_TIPO_FONTE).filter((t) => FONTES_POR_TIPO[form.tipo].includes(t)).map((tipo) => {
            const doGrupo = fontesDoTipo.filter((f) => f.tipo === tipo);
            return doGrupo.length ? (
              <optgroup key={tipo} label={NOMES_TIPO_FONTE[tipo]}>
                {doGrupo.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </optgroup>
            ) : null;
          })}
        </Selecao>

        {!editando && (
          <div className="campo">
            <span className="campo__rotulo">Repetição</span>
            <div className="alternador alternador--3" role="radiogroup" aria-label="Repetição">
              {[
                ['unico', 'Uma vez'],
                ['parcelado', 'Parcelado'],
                ['mensal', 'Todo mês'],
              ].filter(([valor]) => valor !== 'parcelado' || podeParcelar).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={modo === valor}
                  className={`alternador__opcao ${modo === valor ? 'ativo' : ''}`}
                  onClick={() => setModo(valor)}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {modo === 'parcelado' && podeParcelar && (
          <Entrada
            rotulo="Parcelas"
            type="number"
            min={2}
            max={48}
            value={form.parcelas}
            onChange={(e) => mudar('parcelas', e.target.value === '' ? '' : Number(e.target.value))}
            erro={erros.parcelas}
            ajuda={previaParcelas(form.valor, Number(form.parcelas)) ?? 'O valor total é dividido entre as parcelas.'}
          />
        )}

        {modo === 'mensal' && !editando && (() => {
          const meses = mesesEntre(form.data, repetirAte);
          const previa = meses >= 2 && meses <= 60 && Number(form.valor) > 0
            ? `${meses} lançamentos de ${moeda(form.valor)}, de ${nomeMes(form.data.slice(0, 7))} a ${nomeMes(repetirAte)}.`
            : 'O valor cheio se repete todo mês, no mesmo dia.';
          return (
            <Entrada
              rotulo="Repetir até"
              type="month"
              value={repetirAte}
              min={form.data ? mesVizinho(form.data.slice(0, 7), 1) : undefined}
              onChange={(e) => { setRepetirAte(e.target.value); if (erros.repetirAte) setErros({ ...erros, repetirAte: undefined }); }}
              erro={erros.repetirAte}
              ajuda={`${previa} Dá para encerrar antes quando quiser.`}
            />
          );
        })()}

        {recorrenteExistente && (
          <label className="caixa">
            <input type="checkbox" checked={aplicarSeguintes} onChange={(e) => setAplicarSeguintes(e.target.checked)} />
            Aplicar também aos meses seguintes (descrição, valor, categoria e destino)
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
