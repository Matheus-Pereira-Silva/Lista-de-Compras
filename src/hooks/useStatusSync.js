import { useEffect, useState } from 'react';

import { useDebouncedTrue } from './useDebouncedTrue';

const ATRASO_CONEXAO_LENTA_MS = 10000;

// Calcula o estado do selo de sincronização a partir dos três sinais que
// já existem no app (nunca só do NetInfo — uma conexão "online" ainda
// pode ter escritas pendentes, então "Sincronizado" exige as duas
// coisas: online E sem pendência).
export function useStatusSync({ offline, pendente, carregando }) {
  // Mesmo debounce de 400ms já usado nos indicadores "Sincronizando..."
  // existentes, pra não piscar em sincronizações rápidas.
  const pendenteDebounced = useDebouncedTrue(pendente, 400);
  const [conexaoLenta, setConexaoLenta] = useState(false);

  useEffect(() => {
    if (!pendente) {
      setConexaoLenta(false);
      return;
    }

    const timeoutId = setTimeout(() => setConexaoLenta(true), ATRASO_CONEXAO_LENTA_MS);
    return () => clearTimeout(timeoutId);
  }, [pendente]);

  if (carregando) {
    // Ainda no skeleton: não há dado nenhum carregado pra afirmar
    // "Sincronizado" — o componente reserva o espaço e fica invisível.
    return { estado: null, texto: null };
  }

  if (offline) {
    return { estado: 'offline', texto: 'Offline · salvo no aparelho' };
  }

  if (pendenteDebounced) {
    return {
      estado: 'sincronizando',
      texto: conexaoLenta ? 'Sincronizando… conexão lenta' : 'Sincronizando…',
    };
  }

  return { estado: 'sincronizado', texto: 'Sincronizado' };
}
