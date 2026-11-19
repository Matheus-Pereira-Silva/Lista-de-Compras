import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '../theme';

const ToastContext = createContext(() => {});

const DURACAO_VISIVEL_MS = 2200;
const DURACAO_VISIVEL_COM_ACAO_MS = 5000;
const DURACAO_FADE_MS = 200;

// Sobreposto (position absolute) — nunca empurra nem reserva espaço no
// conteúdo da tela por baixo; some sozinho depois de alguns segundos.
// Só fica tocável (pointerEvents) quando tem uma ação (ex: "Desfazer").
function Toast({ toast, onAcionar }) {
  const insets = useSafeAreaInsets();
  const [montado, setMontado] = useState(false);
  const opacidade = useRef(new Animated.Value(0)).current;
  const visivel = !!toast;

  useEffect(() => {
    if (visivel) {
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
  }, [visivel, opacidade]);

  if (!montado) return null;

  return (
    <Animated.View
      pointerEvents={toast?.acaoLabel ? 'box-none' : 'none'}
      style={[styles.container, { bottom: 24 + insets.bottom, opacity: opacidade }]}
    >
      <View style={styles.pill}>
        <Text style={styles.texto} numberOfLines={2}>
          {toast?.mensagem}
        </Text>
        {toast?.acaoLabel && (
          <TouchableOpacity
            onPress={onAcionar}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.acaoTexto}>{toast.acaoLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

// Fila simples de um toast por vez — mostra um pequeno componente de
// feedback (ex: "Item removido", opcionalmente com uma ação como
// "Desfazer") em vez do Alert/Snackbar nativo do sistema, no mesmo
// estilo visual do app.
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  // showToast(mensagem) ou showToast(mensagem, { actionLabel, onAction }).
  // Chamar de novo antes do toast anterior sumir substitui o anterior —
  // se ele tinha uma ação (ex: desfazer uma remoção), ela deixa de valer.
  const showToast = useCallback((mensagem, opcoes) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const acaoLabel = opcoes?.actionLabel ?? null;
    const onAcao = opcoes?.onAction ?? null;
    setToast({ mensagem, acaoLabel, onAcao });

    const duracao = acaoLabel ? DURACAO_VISIVEL_COM_ACAO_MS : DURACAO_VISIVEL_MS;
    timeoutRef.current = setTimeout(() => setToast(null), duracao);
  }, []);

  useEffect(() => () => timeoutRef.current && clearTimeout(timeoutRef.current), []);

  const handleAcionar = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const acao = toast?.onAcao;
    setToast(null);
    acao?.();
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Toast toast={toast} onAcionar={handleAcionar} />
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    gap: theme.spacing.md,
  },
  texto: {
    color: theme.colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  acaoTexto: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
