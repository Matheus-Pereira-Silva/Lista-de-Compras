import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '../theme';

const ToastContext = createContext(() => {});

const DURACAO_VISIVEL_MS = 2200;
const DURACAO_FADE_MS = 200;

// Sobreposto (position absolute) — nunca empurra nem reserva espaço no
// conteúdo da tela por baixo; some sozinho depois de alguns segundos.
function Toast({ mensagem }) {
  const insets = useSafeAreaInsets();
  const [montado, setMontado] = useState(false);
  const opacidade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mensagem) {
      setMontado(true);
      Animated.timing(opacidade, {
        toValue: 1,
        duration: DURACAO_FADE_MS,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacidade, {
        toValue: 0,
        duration: DURACAO_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMontado(false);
      });
    }
  }, [mensagem, opacidade]);

  if (!montado) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { bottom: 24 + insets.bottom, opacity: opacidade }]}
    >
      <Text style={styles.texto} numberOfLines={2}>
        {mensagem}
      </Text>
    </Animated.View>
  );
}

// Fila simples de uma mensagem por vez — some um pequeno componente de
// feedback (ex: "Item removido") em vez do Alert/Snackbar nativo do
// sistema, no mesmo estilo visual do app.
export function ToastProvider({ children }) {
  const [mensagem, setMensagem] = useState(null);
  const timeoutRef = useRef(null);

  const showToast = useCallback((texto) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMensagem(texto);
    timeoutRef.current = setTimeout(() => setMensagem(null), DURACAO_VISIVEL_MS);
  }, []);

  useEffect(() => () => timeoutRef.current && clearTimeout(timeoutRef.current), []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Toast mensagem={mensagem} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: theme.spacing.xl,
    right: theme.spacing.xl,
    alignItems: 'center',
  },
  texto: {
    backgroundColor: theme.colors.textPrimary,
    color: theme.colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
