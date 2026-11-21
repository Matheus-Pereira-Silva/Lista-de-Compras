import { createContext, useContext, useState } from 'react';

// Estado só de teste (painel "Modo de teste" em Configurações) —
// compartilhado via Context porque o interruptor fica numa tela e o
// skeleton que ele força aparecer fica em outras, que continuam
// montadas por baixo na pilha de navegação.
const TestModeContext = createContext({
  forcarSkeleton: false,
  setForcarSkeleton: () => {},
});

export function TestModeProvider({ children }) {
  const [forcarSkeleton, setForcarSkeleton] = useState(false);

  return (
    <TestModeContext.Provider value={{ forcarSkeleton, setForcarSkeleton }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  return useContext(TestModeContext);
}
