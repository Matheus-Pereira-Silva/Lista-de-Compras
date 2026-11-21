import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '../theme';

// Substitui Alert.alert nos menus de opções (ex: "Opções da lista") —
// mesmo visual das outras caixas do app, como um bottom sheet, em vez
// do diálogo nativo do sistema (que também pode vir escuro no modo
// dark do aparelho, mesmo com o app forçado no tema claro).
export default function ActionSheet({ visible, title, options, onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={[styles.sheet, { paddingBottom: theme.spacing.lg + insets.bottom }]}
        >
          <View style={styles.handle} />
          {title && <Text style={styles.title}>{title}</Text>}

          {options.map((opcao, indice) => (
            <TouchableOpacity
              key={opcao.label}
              style={[styles.option, indice > 0 && styles.optionBorder]}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                opcao.onPress();
              }}
            >
              <Text style={[styles.optionText, opcao.destructive && styles.optionTextDestructive]}>
                {opcao.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancelOption} activeOpacity={0.7} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  option: {
    paddingVertical: theme.spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  optionTextDestructive: {
    color: theme.colors.error,
  },
  cancelOption: {
    marginTop: theme.spacing.xs,
    paddingVertical: theme.spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
