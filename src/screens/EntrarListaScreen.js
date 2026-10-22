import { useEffect, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { arrayUnion, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';

import { auth, db } from '../services/firebase';

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

      navigation.replace('DetalheLista', { listaId, listaNome: listaDados.nome });
    } catch (error) {
      console.error('Erro ao entrar na lista:', error);
      setErro('Não foi possível entrar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Entrar em uma lista</Text>
      <Text style={styles.subtitle}>
        Digite o código de 6 letras/números que quem compartilhou te enviou.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="CÓDIGO"
        placeholderTextColor="#9B9B9B"
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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Entrar</Text>
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#1D1D1D',
    lineHeight: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1D1D1D',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 21,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 4,
    textAlign: 'center',
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
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
