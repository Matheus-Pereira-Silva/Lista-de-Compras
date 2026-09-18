import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const COR_BASE = '#E5E5E5';
const COR_BRILHO = 'rgba(255, 255, 255, 0.55)';
const DURACAO_SHIMMER_MS = 1200;

// Bloco cinza com animação de "brilho" varrendo da esquerda para a direita,
// usando só Animated (sem lib de gradiente). A largura da faixa de brilho é
// calculada a partir da largura real do bloco (via onLayout), então o
// movimento fica proporcional em qualquer tamanho — de um checkbox pequeno
// a um card inteiro.
export function SkeletonBlock({ width = '100%', height = 16, borderRadius = 6, style }) {
  const [larguraLayout, setLarguraLayout] = useState(0);
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: DURACAO_SHIMMER_MS,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const larguraBrilho = Math.max(larguraLayout * 0.5, 30);
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-larguraBrilho, larguraLayout + larguraBrilho],
  });

  return (
    <View
      style={[styles.base, { width, height, borderRadius }, style]}
      onLayout={(evento) => setLarguraLayout(evento.nativeEvent.layout.width)}
    >
      {larguraLayout > 0 && (
        <Animated.View
          style={[
            styles.brilho,
            { width: larguraBrilho, transform: [{ translateX }] },
          ]}
        />
      )}
    </View>
  );
}

// Faz o conteúdo real (que substitui o skeleton) aparecer com um fade suave
// em vez de um corte abrupto assim que os dados chegam.
export function FadeInView({ children, style, duration = 250 }) {
  const opacidade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacidade, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [opacidade, duration]);

  return (
    <Animated.View style={[style, { opacity: opacidade }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COR_BASE,
    overflow: 'hidden',
  },
  brilho: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COR_BRILHO,
  },
});

export default SkeletonBlock;
