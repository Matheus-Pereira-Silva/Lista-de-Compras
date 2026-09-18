import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '../services/firebase';

export default function MinhasListasScreen() {
  const insets = useSafeAreaInsets();
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const listasQuery = query(
      collection(db, 'listas'),
      where('membros', 'array-contains', uid)
    );

    const unsubscribe = onSnapshot(listasQuery, (snapshot) => {
      const dados = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      setListas(dados);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const abrirModal = () => {
    setNovaListaNome('');
    setModalVisible(true);
  };

  const fecharModal = () => {
    setModalVisible(false);
    setNovaListaNome('');
  };

  const criarLista = async () => {
    const nome = novaListaNome.trim();
    if (!nome) return;

    setSalvando(true);
    try {
      await addDoc(collection(db, 'listas'), {
        nome,
        membros: [auth.currentUser.uid],
        criadoPor: auth.currentUser.uid,
        criadoEm: serverTimestamp(),
      });
      fecharModal();
    } catch (error) {
      console.error('Erro ao criar lista:', error);
    } finally {
      setSalvando(false);
    }
  };

  const abrirLista = (lista) => {
    console.log('Abrir lista:', lista.id);
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Minhas Listas</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Carregando...</Text>
        </View>
      ) : listas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Você ainda não tem nenhuma lista.{'\n'}Toque no + para criar a primeira.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => abrirLista(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardTitle}>{item.nome}</Text>
              <Text style={styles.cardSubtitle}>0 itens</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={abrirModal}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova lista</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome da lista"
              placeholderTextColor="#9B9B9B"
              value={novaListaNome}
              onChangeText={setNovaListaNome}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={fecharModal}
                disabled={salvando}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={criarLista}
                disabled={salvando || !novaListaNome.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonConfirmText}>
                  {salvando ? 'Criando...' : 'Criar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1D1D1D',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1D',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 34,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1D1D1D',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1D1D1D',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonConfirm: {
    backgroundColor: '#1D9E75',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  modalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
