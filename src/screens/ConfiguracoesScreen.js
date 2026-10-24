import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
} from '@react-native-firebase/auth';
import {
  arrayRemove,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';

import { auth, db } from '../services/firebase';
import { useOffline } from '../hooks/useOffline';
import theme from '../theme';

export default function ConfiguracoesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Enquanto a faixa global de offline está montada, ela já soma
  // insets.top (ver AppNavigator) — não soma de novo aqui.
  const offline = useOffline();

  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const abrirConfirmacao = () => {
    setSenha('');
    setErro(null);
    setMostrarConfirmacao(true);
  };

  const cancelarExclusao = () => {
    setMostrarConfirmacao(false);
    setSenha('');
    setErro(null);
  };

  const excluirConta = async () => {
    const user = auth.currentUser;
    if (!senha) return;

    setErro(null);
    setExcluindo(true);
    try {
      // Reautenticação, exclusão de listas e exclusão da conta exigem o
      // servidor de verdade — diferente das outras telas, aqui não dá
      // pra aplicar nada localmente e sincronizar depois.
      const estadoRede = await NetInfo.fetch();
      if (!estadoRede.isConnected) {
        setErro('Conecte-se à internet para excluir sua conta.');
        return;
      }

      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senha));

      const listasSnapshot = await getDocs(
        query(collection(db, 'listas'), where('membros', 'array-contains', user.uid))
      );

      await Promise.all(
        listasSnapshot.docs.map(async (listaDoc) => {
          const dadosLista = listaDoc.data();

          if (dadosLista.criadoPor === user.uid) {
            // Listas das quais sou dono (só minhas ou compartilhadas):
            // apaga tudo. É a opção mais simples com as regras atuais,
            // que não permitem transferir a posse para outro membro.
            const itensSnapshot = await getDocs(collection(db, 'listas', listaDoc.id, 'itens'));
            const batch = writeBatch(db);
            itensSnapshot.docs.forEach((itemDoc) => batch.delete(itemDoc.ref));
            if (dadosLista.codigoConvite) {
              batch.delete(doc(db, 'convites', dadosLista.codigoConvite));
            }
            batch.delete(listaDoc.ref);
            await batch.commit();
          } else {
            // Membro comum: só saio, a lista continua pros outros.
            await updateDoc(listaDoc.ref, { membros: arrayRemove(user.uid) });
          }
        })
      );

      await deleteUser(user);
      // onAuthStateChanged no AppNavigator leva pra tela de Login.
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErro('Senha incorreta.');
      } else if (error.code === 'auth/too-many-requests') {
        setErro('Muitas tentativas. Aguarde um pouco e tente novamente.');
      } else if (error.code === 'auth/network-request-failed') {
        setErro('Falha de conexão. Verifique sua internet e tente novamente.');
      } else {
        setErro('Não foi possível excluir a conta. Tente novamente.');
      }
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={[styles.header, { paddingTop: (offline ? 0 : insets.top) + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Configurações</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Conta</Text>
        <Text style={styles.emailText}>{auth.currentUser?.email}</Text>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Excluir conta</Text>
          <Text style={styles.dangerText}>
            Isso apaga sua conta e não pode ser desfeito. É preciso estar
            conectado à internet para concluir. Todas as listas criadas por
            você — inclusive as compartilhadas — são apagadas por completo
            (itens e convite inclusos), para todos os membros. Em listas de
            outras pessoas das quais você só participa, você é removido, mas
            elas continuam existindo para os demais membros.
          </Text>

          {!mostrarConfirmacao ? (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={abrirConfirmacao}
              activeOpacity={0.8}
            >
              <Text style={styles.dangerButtonText}>Excluir minha conta</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Confirme sua senha para continuar</Text>
              <TextInput
                keyboardAppearance="light"
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor={theme.colors.textPlaceholder}
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
                autoFocus
              />

              {erro && <Text style={styles.errorText}>{erro}</Text>}

              <View style={styles.confirmacaoActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={cancelarExclusao}
                  disabled={excluindo}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.dangerButton, styles.modalButtonFlex]}
                  onPress={excluirConta}
                  disabled={excluindo || !senha}
                  activeOpacity={0.8}
                >
                  {excluindo ? (
                    <ActivityIndicator color={theme.colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.dangerButtonText}>Confirmar exclusão</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  sectionLabel: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs + 2,
  },
  emailText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xl + 4,
  },
  dangerCard: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl - 6,
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  dangerText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: theme.spacing.lg,
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: theme.colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldLabel: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    marginBottom: theme.spacing.md,
  },
  confirmacaoActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg + 4,
    borderRadius: theme.radius.md,
  },
  modalButtonFlex: {
    flex: 1,
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.backgroundMuted,
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
