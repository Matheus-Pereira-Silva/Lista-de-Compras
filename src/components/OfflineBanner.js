import { StyleSheet, Text, View } from 'react-native';

// Altura fixa só da linha de texto — a folga da área segura (insets.top)
// é somada por quem monta este componente (AppNavigator), não por ele.
export const OFFLINE_BANNER_HEIGHT = 28;

// Faixa global de "sem conexão": montada/desmontada de verdade pelo
// AppNavigator (não só opacidade), empurrando o conteúdo das telas pra
// baixo enquanto offline. O salto ao entrar/sair desse estado é
// aceitável — é uma mudança real, não uma flutuação de rede passageira.
export default function OfflineBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.texto} numberOfLines={1}>
        Você está offline. Alterações serão sincronizadas ao reconectar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: OFFLINE_BANNER_HEIGHT,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
  },
});
