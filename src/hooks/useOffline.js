import { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

const OfflineContext = createContext(false);

// Um único listener do NetInfo pro app inteiro, compartilhado via
// contexto — assim o AppNavigator (que empurra o conteúdo) e cada tela
// (que decide se soma insets.top no próprio cabeçalho) sempre veem
// exatamente o mesmo valor, sem risco de ficarem dessincronizados.
export function OfflineProvider({ children }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // isConnected começa null até a primeira leitura real do NetInfo —
    // só trata como offline quando for false de verdade.
    const unsubscribe = NetInfo.addEventListener((estado) => {
      setOffline(estado.isConnected === false);
    });

    return unsubscribe;
  }, []);

  return <OfflineContext.Provider value={offline}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  return useContext(OfflineContext);
}
