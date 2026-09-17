import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from '../services/firebase';

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

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
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
    setIsSignUp((previous) => !previous);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor="#9B9B9B"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#9B9B9B"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        disabled={loading || !email || !password}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isSignUp ? 'Criar conta' : 'Entrar'}</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1D1D1D',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B6B',
    marginBottom: 32,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    width: '100%',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#1D9E75',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  tabTextActive: {
    color: '#fff',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1D1D1D',
    marginBottom: 16,
  },
  errorText: {
    color: '#D14343',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1D9E75',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
