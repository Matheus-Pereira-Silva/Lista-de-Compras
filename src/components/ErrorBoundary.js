import { Component } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1D1D1D',
    marginBottom: 8,
    textAlign: 'center',
  },
  texto: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 21,
  },
  botao: {
    backgroundColor: '#1D9E75',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  botaoTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
