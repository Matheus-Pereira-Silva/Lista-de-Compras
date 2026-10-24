import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import theme from '../theme';

// Substitui Alert.alert nas confirmações do app — mesmo visual das
// outras caixas (cartão claro, botões no estilo do app), em vez do
// diálogo nativo do sistema (que também pode vir escuro no modo dark
// do aparelho, mesmo com o app forçado no tema claro).
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonCancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, destructive ? styles.buttonDestructive : styles.buttonConfirm]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text
                style={destructive ? styles.buttonDestructiveText : styles.buttonConfirmText}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg + 4,
    borderRadius: theme.radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: {
    backgroundColor: theme.colors.backgroundMuted,
  },
  buttonConfirm: {
    backgroundColor: theme.colors.primary,
  },
  buttonDestructive: {
    backgroundColor: theme.colors.errorLight,
  },
  buttonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  buttonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textOnPrimary,
  },
  buttonDestructiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.error,
  },
});
