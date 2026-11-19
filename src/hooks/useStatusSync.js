import { useEffect, useState } from 'react';

import { useDebouncedTrue } from './useDebouncedTrue';

const ATRASO_CONEXAO_LENTA_MS = 10000;
const ATUALIZACAO_RELATIVA_MS = 60000;

// "agora" (<1min), "há N min" (<60min) ou "há N h" — formato curto pro
// selo, que não tem espaço pra uma data completa.
function formatarTempoRelativo(msDesde) {
  const minutos = Math.floor(msDesde / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas} h`;
}

// Calcula o estado do selo de sincronização a partir dos sinais que já
// existem no app (nunca só do NetInfo — uma conexão "online" ainda pode
// ter escritas pendentes, então "Sincronizado" exige as duas coisas:
// online E sem pendência).
export function useStatusSync({ offline, pendente, carregando, ultimaSincronizacao }) {
  // Mesmo debounce de 400ms já usado nos indicadores "Sincronizando..."
  // existentes, pra não piscar em sincronizações rápidas.
  const pendenteDebounced = useDebouncedTrue(pendente, 400);
  const [conexaoLenta, setConexaoLenta] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!pendente) {
      setConexaoLenta(false);
      return;
    }

    const timeoutId = setTimeout(() => setConexaoLenta(true), ATRASO_CONEXAO_LENTA_MS);
    return () => clearTimeout(timeoutId);
  }, [pendente]);

  // Só liga o relógio de "há X min" enquanto offline — é o único estado
  // que mostra esse texto, então não há por que recalcular fora dele.
  useEffect(() => {
    if (!offline) return;

    setAgora(Date.now());
    const intervalId = setInterval(() => setAgora(Date.now()), ATUALIZACAO_RELATIVA_MS);
    return () => clearInterval(intervalId);
  }, [offline]);

  if (carregando) {
    // Ainda no skeleton: não há dado nenhum carregado pra afirmar
    // "Sincronizado" — o componente reserva o espaço e fica invisível.
    return { estado: null, texto: null };
  }

  if (offline) {
    if (ultimaSincronizacao == null) {
      return { estado: 'offline', texto: 'Offline · salvo no aparelho' };
    }

    const relativo = formatarTempoRelativo(agora - ultimaSincronizacao);
    return { estado: 'offline', texto: `Offline · última sincronização ${relativo}` };
  }

  if (pendenteDebounced) {
    return {
      estado: 'sincronizando',
      texto: conexaoLenta ? 'Sincronizando… conexão lenta' : 'Sincronizando…',
    };
  }

  return { estado: 'sincronizado', texto: 'Sincronizado' };
}
