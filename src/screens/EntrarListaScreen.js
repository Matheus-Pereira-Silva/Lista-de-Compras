import { useEffect, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { arrayUnion, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';

import { auth, db } from '../services/firebase';
import theme from '../theme';

export default function EntrarListaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [codigo, setCodigo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  // Preenche sozinho quando a tela é aberta por um link de convite
  // (https://.../convite/{codigo} ou listacompras://convite/{codigo}).
  useEffect(() => {
    if (route.params?.codigo) {
      setCodigo(route.params.codigo.toUpperCase());
    }
  }, [route.params?.codigo]);

  const entrar = async () => {
    const codigoLimpo = codigo.trim().toUpperCase();
    if (!codigoLimpo) return;

    setErro(null);
    setCarregando(true);
    try {
      // Essa etapa exige internet de verdade: ler um convite que o
      // dispositivo nunca viu antes não tem como vir do cache local.
      const estadoRede = await NetInfo.fetch();
      if (!estadoRede.isConnected) {
        setErro('Conecte-se à internet para entrar em uma lista.');
        return;
      }

      const conviteSnapshot = await getDoc(doc(db, 'convites', codigoLimpo));
      if (!conviteSnapshot.exists()) {
        setErro('Código inválido.');
        return;
      }

      const { listaId } = conviteSnapshot.data();
      const listaSnapshot = await getDoc(doc(db, 'listas', listaId));
      if (!listaSnapshot.exists()) {
        setErro('Código inválido.');
        return;
      }

      const listaDados = listaSnapshot.data();
      const uid = auth.currentUser.uid;
      if (!listaDados.membros?.includes(uid)) {
        await updateDoc(doc(db, 'listas', listaId), {
          membros: arrayUnion(uid),
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      navigation.replace('DetalheLista', { listaId, listaNome: listaDados.nome });
    } catch (error) {
      console.error('Erro ao entrar na lista:', error);
      setErro('Não foi possível entrar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
        accessibilityLabel="Voltar"
      >
        <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Entrar em uma lista</Text>
        <Text style={styles.subtitle}>
          Digite o código de 6 letras/números que quem compartilhou te enviou.
        </Text>

        <TextInput

          keyboardAppearance="light"
          style={styles.input}
          placeholder="CÓDIGO"
          placeholderTextColor={theme.colors.textPlaceholder}
          value={codigo}
          onChangeText={(texto) => setCodigo(texto.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />

        {erro && <Text style={styles.errorText}>{erro}</Text>}

        <TouchableOpacity
          style={styles.button}
          onPress={entrar}
          disabled={carregando || !codigo.trim()}
          activeOpacity={0.8}
        >
          {carregando ? (
            <ActivityIndicator color={theme.colors.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: theme.spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xxl,
    textAlign: 'center',
    lineHeight: 21,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 4,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.md,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...theme.typography.bodyBold,
    color: theme.colors.textOnPrimary,
  },
});
