module.exports = {
  expo: {
    name: 'Lista de Compras',
    slug: 'ListaCompras',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
    },
    scheme: 'listacompras',
    android: {
      // userInterfaceStyle no nivel raiz nao basta no Android — precisa
      // do plugin expo-system-ui (ver abaixo) pra esse valor realmente
      // forcar o tema claro, inclusive em dialogos e teclado nativos.
      userInterfaceStyle: 'light',
      adaptiveIcon: {
        backgroundColor: '#1D9E75',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      package: 'com.prismastudio.listacompras',
      // No EAS Build, a variavel de arquivo GOOGLE_SERVICES_JSON e
      // materializada em disco e essa env var aponta pro caminho real.
      // Localmente, cai no arquivo baixado do Firebase Console na raiz.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      // Link de convite com dominio verdadeiro (autoVerify) e o esquema
      // customizado (listacompras://convite/{codigo}) como fallback.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'listacompras-c4c86.web.app',
              pathPrefix: '/convite',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: '7876bc81-dafc-4792-aad8-ff74fe906dff',
      },
    },
    plugins: [
      'expo-image',
      'expo-system-ui',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 220,
          resizeMode: 'contain',
          backgroundColor: '#1D9E75',
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
    ],
  },
};
