import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from '@react-native-firebase/auth';

import { auth } from '../services/firebase';
import LoginScreen from '../screens/LoginScreen';
import MinhasListasScreen from '../screens/MinhasListasScreen';
import DetalheListaScreen from '../screens/DetalheListaScreen';
import EntrarListaScreen from '../screens/EntrarListaScreen';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

// Reconhece tanto https://.../convite/{codigo} quanto listacompras://convite/{codigo}
// — as duas URLs têm o mesmo trecho "convite/CODIGO" em comum.
function extrairCodigoConviteDaUrl(url) {
  if (!url) return null;
  const correspondencia = url.match(/convite\/([A-Z0-9]{6})/i);
  return correspondencia ? correspondencia[1].toUpperCase() : null;
}

export default function AppNavigator() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const isFirstAuthCallback = useRef(true);
  const codigoPendenteRef = useRef(null);

  // Só navega pro código pendente quando já estiver logado E a navegação
  // já tiver montado — senão guarda e tenta de novo depois (ver efeitos
  // abaixo).
  const tentarNavegarComCodigoPendente = () => {
    if (!codigoPendenteRef.current) return;
    if (!auth.currentUser) return;
    if (!navigationRef.isReady()) return;

    const codigo = codigoPendenteRef.current;
    codigoPendenteRef.current = null;
    navigationRef.navigate('EntrarLista', { codigo });
  };

  useEffect(() => {
    const processarUrl = (url) => {
      const codigo = extrairCodigoConviteDaUrl(url);
      if (!codigo) return;

      // Guarda sempre — se ainda não estiver logado, fica pendente até
      // o login completar (ver o efeito abaixo, que observa `user`).
      codigoPendenteRef.current = codigo;
      tentarNavegarComCodigoPendente();
    };

    Linking.getInitialURL().then(processarUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => processarUrl(url));

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (isFirstAuthCallback.current) {
        isFirstAuthCallback.current = false;
        setInitializing(false);
        return;
      }

      if (navigationRef.isReady()) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: currentUser ? 'MinhasListas' : 'Login' }],
        });
      }
    });

    return unsubscribe;
  }, []);

  // Dispara de novo sempre que a navegação terminar de inicializar ou o
  // usuário logar — cobre tanto "abriu o link já logado" quanto "abriu o
  // link deslogado, logou depois".
  useEffect(() => {
    tentarNavegarComCodigoPendente();
  }, [initializing, user]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={user ? 'MinhasListas' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MinhasListas" component={MinhasListasScreen} />
        <Stack.Screen name="DetalheLista" component={DetalheListaScreen} />
        <Stack.Screen name="EntrarLista" component={EntrarListaScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
