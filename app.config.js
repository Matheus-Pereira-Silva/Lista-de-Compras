module.exports = {
  expo: {
    name: 'ListaCompras',
    slug: 'ListaCompras',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      package: 'com.prismastudio.listacompras',
      // No EAS Build, a variavel de arquivo GOOGLE_SERVICES_JSON e
      // materializada em disco e essa env var aponta pro caminho real.
      // Localmente, cai no arquivo baixado do Firebase Console na raiz.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: '7876bc81-dafc-4792-aad8-ff74fe906dff',
      },
    },
    plugins: ['expo-image', '@react-native-firebase/app', '@react-native-firebase/auth'],
  },
};
