import { Link, Route, Routes } from 'react-router-dom';
import { RotaProtegida, RotaPublica } from './components/layout/Layout.jsx';
import Login from './components/paginas/Login.jsx';
import Cadastro from './components/paginas/Cadastro.jsx';
import Dashboard from './components/paginas/Dashboard.jsx';
import Lancamentos from './components/paginas/Lancamentos.jsx';
import Categorias from './components/paginas/Categorias.jsx';
import FontesDestinos from './components/paginas/FontesDestinos.jsx';
import Relatorios from './components/paginas/Relatorios.jsx';
import Faturas from './components/paginas/Faturas.jsx';
import SaudeFinanceira from './components/paginas/SaudeFinanceira.jsx';
import { Vazio } from './components/ui/Estados.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RotaPublica><Login /></RotaPublica>} />
      <Route path="/cadastro" element={<RotaPublica><Cadastro /></RotaPublica>} />
      <Route element={<RotaProtegida />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lancamentos" element={<Lancamentos />} />
        <Route path="/categorias" element={<Categorias />} />
        <Route path="/fontes-destinos" element={<FontesDestinos />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/faturas" element={<Faturas />} />
        <Route path="/saude-financeira" element={<SaudeFinanceira />} />
        <Route path="*" element={<Vazio titulo="Página não encontrada"><Link to="/" className="link">Voltar ao resumo</Link></Vazio>} />
      </Route>
    </Routes>
  );
}
