import { Component } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import theme from '../theme';

// Rede de segurança final: se qualquer erro não tratado escapar até aqui
// (por exemplo, algo fora dos onSnapshot/addDoc já protegidos), mostra uma
// tela de erro com opção de tentar novamente, em vez de deixar o app
// fechar sozinho sem nenhum aviso.
export default class ErrorBoundary extends Component {
  state = { temErro: false };

  static getDerivedStateFromError() {
    return { temErro: true };
  }

  componentDidCatch(error, info) {
    console.error('Erro inesperado capturado pelo ErrorBoundary:', error, info);
  }

  tentarNovamente = () => {
    this.setState({ temErro: false });
  };

  render() {
    if (this.state.temErro) {
      return (
        <View style={styles.container}>
          <Text style={styles.titulo}>Algo deu errado</Text>
          <Text style={styles.texto}>
            Ocorreu um erro inesperado. Tente novamente.
          </Text>
          <TouchableOpacity
            style={styles.botao}
            onPress={this.tentarNovamente}
            activeOpacity={0.8}
          >
            <Text style={styles.botaoTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    backgroundColor: theme.colors.background,
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  texto: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 21,
  },
  botao: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.md,
  },
  botaoTexto: {
    color: theme.colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
