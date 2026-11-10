import { useCallback, useEffect, useRef, useState } from 'react';
import { lerErro } from '../../services/api.js';

// Busca dados e controla carregando / erro. `dependencias` dispara uma nova busca quando mudam.
export function useCarregar(buscar, dependencias = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const ultimaBusca = useRef(0);

  const executar = useCallback(async () => {
    const numero = ++ultimaBusca.current;
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }));
    try {
      const dados = await buscar();
      if (numero === ultimaBusca.current) setEstado({ dados, carregando: false, erro: null });
    } catch (erro) {
      if (numero === ultimaBusca.current) setEstado((atual) => ({ ...atual, carregando: false, erro: lerErro(erro).mensagem }));
    }
  }, dependencias);

  useEffect(() => { executar(); }, [executar]);

  return { ...estado, recarregar: executar };
}
