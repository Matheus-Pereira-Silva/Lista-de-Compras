import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Faixa global de "sem conexão". Fica sobreposta (position: absolute) em
// vez de ocupar espaço no fluxo normal — assim nunca empurra o conteúdo
// das telas (cada uma já soma insets.top no próprio cabeçalho) e nunca
// causa salto de layout quando a conexão cai ou volta: só a opacidade
// muda, a área ocupada é sempre a mesma. pointerEvents "none" pra nunca
// bloquear toques nos botões do cabeçalho por baixo.
export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const opacidade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // isConnected começa null até a primeira leitura real do NetInfo —
    // só trata como offline quando for false de verdade, pra não mostrar
    // a faixa por engano logo na abertura do app.
    const unsubscribe = NetInfo.addEventListener((estado) => {
      setOffline(estado.isConnected === false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.timing(opacidade, {
      toValue: offline ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [offline, opacidade]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { top: insets.top, opacity: opacidade }]}
    >
      <Text style={styles.texto}>
        Você está offline. Suas alterações serão sincronizadas quando a conexão voltar.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    textAlign: 'center',
  },
});
