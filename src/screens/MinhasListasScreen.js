import { StyleSheet, Text, View } from 'react-native';

export default function MinhasListasScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Minhas Listas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1D1D1D',
  },
});
