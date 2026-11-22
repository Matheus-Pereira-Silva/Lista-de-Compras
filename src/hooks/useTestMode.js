import { createContext, useContext, useEffect, useState } from 'react';

// Estado só de teste (painel "Modo de teste" em Configurações) —
// compartilhado via Context porque os interruptores ficam numa tela e
// o skeleton/spinner que eles forçam aparecer fica em outras, que
// continuam montadas por baixo na pilha de navegação.
const TestModeContext = createContext({
  forcarSkeleton: false,
  setForcarSkeleton: () => {},
  forcarSpinner: false,
  setForcarSpinner: () => {},
});

export function TestModeProvider({ children }) {
  const [forcarSkeleton, setForcarSkeletonState] = useState(false);
  const [forcarSpinner, setForcarSpinnerState] = useState(false);

  // Mutuamente exclusivos — ligar um desliga o outro.
  const setForcarSkeleton = (valor) => {
    setForcarSkeletonState(valor);
    if (valor) setForcarSpinnerState(false);
  };

  const setForcarSpinner = (valor) => {
    setForcarSpinnerState(valor);
    if (valor) setForcarSkeletonState(false);
  };

  return (
    <TestModeContext.Provider
      value={{ forcarSkeleton, setForcarSkeleton, forcarSpinner, setForcarSpinner }}
    >
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  return useContext(TestModeContext);
}

const DURACAO_SKELETON_FORCADO_MS = 3000;

// Com o interruptor ligado, cada tela que chama isso mostra o skeleton
// por um tempo fixo (simulando um carregamento lento) e depois libera
// pro conteúdo real sozinho — tanto ao montar (ex: entrar numa lista)
// quanto no instante em que o interruptor é ligado.
export function useSkeletonForcado() {
  const { forcarSkeleton } = useTestMode();
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    if (!forcarSkeleton) {
      setAtivo(false);
      return;
    }

    setAtivo(true);
    const timeoutId = setTimeout(() => setAtivo(false), DURACAO_SKELETON_FORCADO_MS);
    return () => clearTimeout(timeoutId);
  }, [forcarSkeleton]);

  return ativo;
}
