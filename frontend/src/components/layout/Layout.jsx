import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Carregando } from '../ui/Estados.jsx';

const MENU = [
  { para: '/', rotulo: 'Resumo', fim: true },
  { para: '/lancamentos', rotulo: 'Lançamentos' },
  { para: '/faturas', rotulo: 'Faturas' },
  { para: '/relatorios', rotulo: 'Relatórios' },
  { para: '/saude-financeira', rotulo: 'Saúde financeira' },
  { separador: true },
  { para: '/categorias', rotulo: 'Categorias' },
  { para: '/fontes-destinos', rotulo: 'Fontes e destinos' },
];

export function RotaProtegida() {
  const { autenticado, verificando } = useAuth();
  const local = useLocation();
  if (!autenticado) return <Navigate to="/login" replace state={{ voltarPara: local.pathname }} />;
  if (verificando) return <Carregando texto="Abrindo sua caderneta…" />;
  return <Layout />;
}

export function RotaPublica({ children }) {
  const { autenticado } = useAuth();
  return autenticado ? <Navigate to="/" replace /> : children;
}

function Layout() {
  const { usuario, logout } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const primeiroNome = usuario?.nome?.split(' ')[0] ?? '';

  return (
    <div className="app">
      <aside className={`lateral ${menuAberto ? 'lateral--aberta' : ''}`}>
        <div className="lateral__marca">
          <span className="marca__simbolo">R$</span>
          <span className="marca__nome">Caderneta</span>
          <button type="button" className="botao-icone lateral__alternar" onClick={() => setMenuAberto((v) => !v)} aria-label="Abrir menu">
            {menuAberto ? '×' : '≡'}
          </button>
        </div>
        <nav className="lateral__menu" onClick={() => setMenuAberto(false)}>
          {MENU.map((item, i) => (item.separador
            ? <hr key={i} />
            : <NavLink key={item.para} to={item.para} end={item.fim}>{item.rotulo}</NavLink>))}
        </nav>
        <div className="lateral__usuario">
          <span title={usuario?.email}>Olá, {primeiroNome}</span>
          <button type="button" className="link" onClick={() => logout()}>Sair</button>
        </div>
      </aside>
      <main className="principal">
        <Outlet />
      </main>
    </div>
  );
}

export function Cabecalho({ titulo, subtitulo, children }) {
  return (
    <header className="cabecalho">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="cabecalho__sub">{subtitulo}</p>}
      </div>
      {children && <div className="cabecalho__acoes">{children}</div>}
    </header>
  );
}
