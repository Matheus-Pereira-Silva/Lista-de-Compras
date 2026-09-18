import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

// Mostra/esconde os filhos com um fade suave em vez de aparecer/sumir
// abruptamente. Usado pelos indicadores de "sincronizando" — quando
// hasPendingWrites vira false, o indicador some com uma transição de
// opacidade em vez de um corte seco.
export function FadePresence({ visible, duration = 250, style, children }) {
  const [montado, setMontado] = useState(visible);
  const opacidade = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMontado(true);
      Animated.timing(opacidade, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacidade, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMontado(false);
      });
    }
  }, [visible, duration, opacidade]);

  if (!montado) return null;

  return (
    <Animated.View style={[style, { opacity: opacidade }]}>
      {children}
    </Animated.View>
  );
}

// Variante que fica sempre montada — anima só opacidade/translateY, nunca
// desmonta nem afeta a altura ocupada no layout. Use quando o
// aparecer/sumir não pode empurrar o conteúdo vizinho (ex: uma faixa fixa
// no topo da tela, acima de uma lista).
export function PersistentFade({
  visible,
  duration = 250,
  style,
  children,
  slide = true,
}) {
  const progresso = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progresso, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [visible, duration, progresso]);

  const translateY = progresso.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  return (
    <Animated.View
      style={[
        style,
        { opacity: progresso },
        slide && { transform: [{ translateY }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
}

export default FadePresence;
