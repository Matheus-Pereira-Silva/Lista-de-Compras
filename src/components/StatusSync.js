import { StyleSheet, Text, View } from 'react-native';

import theme from '../theme';
import { useStatusSync } from '../hooks/useStatusSync';
import { PersistentFade } from './FadePresence';

const CORES = {
  sincronizado: theme.colors.primary,
  sincronizando: theme.colors.warning,
  offline: theme.colors.offlineSoft,
};

// Bolinha de 8px + palavra curta — feedback contínuo e discreto do
// estado de sincronização. Substitui a faixa "Alterações pendentes" e o
// banner global de offline. Altura sempre reservada (ver PersistentFade);
// só a opacidade alterna entre estados, nunca o espaço ocupado.
export default function StatusSync({ offline, pendente, carregando, ultimaSincronizacao, style }) {
  const { estado, texto } = useStatusSync({ offline, pendente, carregando, ultimaSincronizacao });
  const visivel = estado != null;
  const cor = CORES[estado] || theme.colors.primary;

  return (
    <View
      accessible={visivel}
      accessibilityLiveRegion="polite"
      accessibilityLabel={texto ?? undefined}
    >
      <PersistentFade visible={visivel} slide={false} style={[styles.container, style]}>
        <View style={[styles.bolinha, { backgroundColor: cor }]} />
        <Text style={[styles.texto, { color: cor }]} numberOfLines={1}>
          {texto}
        </Text>
      </PersistentFade>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
    gap: 6,
  },
  bolinha: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
  },
});
