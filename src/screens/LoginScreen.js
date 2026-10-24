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
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from '@react-native-firebase/auth';

import { auth } from '../services/firebase';
import theme from '../theme';

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Esse e-mail já está em uso. Tente entrar em vez de criar conta.',
  'auth/invalid-email': 'E-mail inválido. Confira e tente novamente.',
  'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/missing-password': 'Digite uma senha.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  'auth/operation-not-allowed': 'Login por e-mail e senha não está habilitado no momento.',
  'auth/network-request-failed': 'Falha de conexão. Verifique sua internet e tente novamente.',
};

const DEFAULT_ERROR_MESSAGE = 'Não foi possível concluir. Tente novamente.';

// Mesma mensagem tanto quando o e-mail existe quanto quando não existe —
// de propósito, pra não deixar alguém descobrir por aqui quais e-mails
// estão cadastrados.
const MENSAGEM_RECUPERACAO_ENVIADA =
  'Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.';

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // A navegação para "MinhasListas" acontece automaticamente via
      // onAuthStateChanged no AppNavigator.
    } catch (error) {
      setErrorMessage(ERROR_MESSAGES[error.code] || DEFAULT_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSignUp((previous) => !previous);
  };

  const handleForgotPassword = async () => {
    const emailTrim = email.trim();
    if (!emailTrim) {
      setInfoMessage(null);
      setErrorMessage('Digite seu e-mail para recuperar a senha.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setRecuperandoSenha(true);
    try {
      await sendPasswordResetEmail(auth, emailTrim);
      setInfoMessage(MENSAGEM_RECUPERACAO_ENVIADA);
    } catch (error) {
      // 'user-not-found' e outros erros que revelariam se o e-mail existe
      // caem na mesma mensagem de sucesso; só erros de verdade (e-mail
      // malformado, sem rede, etc) mostram algo diferente.
      if (error.code === 'auth/invalid-email') {
        setErrorMessage('E-mail inválido. Confira e tente novamente.');
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage('Falha de conexão. Verifique sua internet e tente novamente.');
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMessage('Muitas tentativas. Aguarde um pouco e tente novamente.');
      } else {
        setInfoMessage(MENSAGEM_RECUPERACAO_ENVIADA);
      }
    } finally {
      setRecuperandoSenha(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Lista de Compras</Text>
        <Text style={styles.subtitle}>Organize suas compras de forma simples</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, !isSignUp && styles.tabActive]}
            onPress={() => !isSignUp || toggleMode()}
          >
            <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isSignUp && styles.tabActive]}
            onPress={() => isSignUp || toggleMode()}
          >
            <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>Criar conta</Text>
          </TouchableOpacity>
        </View>

        <TextInput

          keyboardAppearance="light"
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor={theme.colors.textPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput

          keyboardAppearance="light"
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor={theme.colors.textPlaceholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!isSignUp && (
          <TouchableOpacity
            style={styles.forgotPasswordLink}
            onPress={handleForgotPassword}
            disabled={recuperandoSenha}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
          </TouchableOpacity>
        )}

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        {infoMessage && <Text style={styles.infoText}>{infoMessage}</Text>}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={loading || !email || !password}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? 'Criar conta' : 'Entrar'}</Text>
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
  title: {
    ...theme.typography.title,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xxl,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundMuted,
    borderRadius: theme.radius.md,
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
    width: '100%',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.textOnPrimary,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.lg,
  },
  forgotPasswordText: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  infoText: {
    color: theme.colors.primary,
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
    marginTop: theme.spacing.xs,
  },
  buttonText: {
    ...theme.typography.bodyBold,
    color: theme.colors.textOnPrimary,
  },
});
