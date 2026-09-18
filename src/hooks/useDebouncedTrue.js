import { useEffect, useState } from 'react';

// Só retorna true se `valor` permanecer true por mais de `delayMs` seguido.
// Se `valor` virar false antes disso, o timer é cancelado e o retorno nunca
// chega a virar true — evita o "flash" de indicadores de sincronização em
// conexões rápidas, onde hasPendingWrites some em poucos milissegundos.
export function useDebouncedTrue(valor, delayMs = 400) {
  const [debounced, setDebounced] = useState(false);

  useEffect(() => {
    if (!valor) {
      setDebounced(false);
      return;
    }

    const timeoutId = setTimeout(() => setDebounced(true), delayMs);
    return () => clearTimeout(timeoutId);
  }, [valor, delayMs]);

  return debounced;
}

export default useDebouncedTrue;
