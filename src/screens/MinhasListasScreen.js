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
import { useNavigation } from '@react-navigation/native';
import { signOut } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '../services/firebase';
import { FadeInView, SkeletonBlock } from '../components/SkeletonCard';
import { PersistentFade } from '../components/FadePresence';
import { useDebouncedTrue } from '../hooks/useDebouncedTrue';

const QUANTIDADE_CARDS_SKELETON = 4;

const formatarPreco = (valor) => `R$ ${valor.toFixed(2).replace('.', ',')}`;

const EMOJIS_LISTA = ['🛒', '🥬', '🍞', '🧴', '🥛', '🍎', '🏠', '🎉', '🥩', '🧃'];

// Índice estável derivado do nome — a mesma lista sempre cai no mesmo
// emoji, sem precisar salvar nada novo no Firestore.
function obterEmojiLista(nome) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) {
    soma += nome.charCodeAt(i);
  }
  return EMOJIS_LISTA[soma % EMOJIS_LISTA.length];
}

function formatarDataCurta(timestamp) {
  if (!timestamp?.toDate) return null;
  const data = timestamp.toDate();
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}

// Cada card tem seu próprio onSnapshot na subcoleção de itens — funciona
// offline pelo cache do Firestore e evita um "0 itens" fixo e falso.
function ListaCard({ lista, onPress }) {
  const [itens, setItens] = useState(null); // null = ainda sem nenhum snapshot
  const [erroItens, setErroItens] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'listas', lista.id, 'itens'),
      (snapshot) => {
        setItens(snapshot.docs.map((docSnapshot) => docSnapshot.data()));
        setErroItens(null);
      },
      (error) => {
        console.error('Erro ao carregar itens da lista', lista.id, error);
        // Mantém o que já tinha (não reseta pra null) — se já carregou antes,
        // continua mostrando o último estado bom. Se nunca carregou, o erro
        // vira mensagem no lugar do skeleton (em vez de ficar preso nele).
        setErroItens(
          error.code === 'firestore/permission-denied'
            ? 'Sem permissão para ver os itens.'
            : 'Não foi possível carregar os itens.'
        );
      }
    );

    return unsubscribe;
  }, [lista.id]);

  const carregando = itens === null;
  const totalItens = itens?.length ?? 0;
  const totalComprados = itens?.filter((item) => item.status === 'comprado').length ?? 0;
  const itensPendentesComPreco = itens
    ? itens.filter((item) => item.status !== 'comprado' && typeof item.preco === 'number')
    : [];
  const totalEstimado = itensPendentesComPreco.reduce((total, item) => total + item.preco, 0);
  const temPreco = itensPendentesComPreco.length > 0;
  const concluida = totalItens > 0 && totalComprados === totalItens;
  const progresso = totalItens > 0 ? totalComprados / totalItens : 0;

  const emoji = obterEmojiLista(lista.nome);
  const dataTexto = formatarDataCurta(lista.criadoEm);
  const quantidadeMembros = lista.membros?.length ?? 0;

  const pendenteDebounced = useDebouncedTrue(!!lista.pendenteSincronizacao, 400);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(lista)} activeOpacity={0.8}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardIconBox}>
          <Text style={styles.cardIconText}>{emoji}</Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {lista.nome}
          </Text>
          <Text style={styles.cardData}>{dataTexto ? `criada em ${dataTexto}` : ''}</Text>
        </View>

        {!carregando && concluida && (
          <View style={styles.badgeConcluida}>
            <Text style={styles.badgeConcluidaTexto}>Concluída</Text>
          </View>
        )}
      </View>

      {carregando ? (
        <View style={styles.progressoContainer}>
          {erroItens ? (
            <Text style={styles.progressoTexto}>{erroItens}</Text>
          ) : (
            <SkeletonBlock width="70%" height={10} borderRadius={4} />
          )}
        </View>
      ) : (
        <View style={styles.progressoContainer}>
          <View style={styles.progressoTrilha}>
            <View style={[styles.progressoPreenchido, { width: `${progresso * 100}%` }]} />
          </View>
          <Text style={styles.progressoTexto}>
            {totalItens === 0 ? 'Lista vazia' : `${totalComprados} de ${totalItens} comprados`}
          </Text>
        </View>
      )}

      <View style={styles.cardFooterRow}>
        <View style={styles.badgeMembros}>
          <Text style={styles.badgeMembrosTexto}>👤 {quantidadeMembros}</Text>
        </View>

        {!carregando && temPreco && (
          <Text style={styles.cardTotalEstimado}>{formatarPreco(totalEstimado)}</Text>
        )}
      </View>

      <PersistentFade visible={pendenteDebounced} slide={false} style={styles.cardSyncSlot}>
        <Text style={styles.cardSyncTexto}>🕒 Sincronizando...</Text>
      </PersistentFade>
    </TouchableOpacity>
  );
}

export default function MinhasListasScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const listasQuery = query(
      collection(db, 'listas'),
      where('membros', 'array-contains', uid)
    );

    const unsubscribe = onSnapshot(
      listasQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const dados = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
          pendenteSincronizacao: docSnapshot.metadata.hasPendingWrites,
        }));

        // Mais nova primeiro, sem orderBy na query (evita índice composto).
        // Listas recém-criadas offline ainda não tem criadoEm resolvido
        // pelo servidor (vem null) — tratamos como as mais recentes.
        dados.sort((a, b) => {
          const tempoA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : null;
          const tempoB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : null;
          if (tempoA == null && tempoB == null) return 0;
          if (tempoA == null) return -1;
          if (tempoB == null) return 1;
          return tempoB - tempoA;
        });

        setListas(dados);
        setErro(null);
        setLoading(false);
      },
      (error) => {
        // Sem esse callback, um erro do onSnapshot (ex: regras do Firestore
        // em modo de teste expirando e passando a responder
        // "permission-denied") derrubava o app inteiro sem aviso — foi
        // exatamente isso que causou o crash logo após login/cadastro.
        console.error('Erro ao carregar listas:', error);
        setErro(
          error.code === 'firestore/permission-denied'
            ? 'Sem permissão para acessar os dados.'
            : 'Não foi possível carregar. Tente novamente.'
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const temListasPendentes = listas.some((lista) => lista.pendenteSincronizacao);
  const temListasPendentesDebounced = useDebouncedTrue(temListasPendentes, 400);

  const abrirModal = () => {
    setNovaListaNome('');
    setModalVisible(true);
  };

  const fecharModal = () => {
    setModalVisible(false);
    setNovaListaNome('');
  };

  const criarLista = () => {
    const nome = novaListaNome.trim();
    if (!nome) return;

    // Não aguarda a promise: o Firestore aplica a criação localmente na
    // hora (Optimistic UI) e sincroniza em segundo plano. Esperar por ela
    // deixaria o modal preso em "Criando..." indefinidamente quando offline.
    addDoc(collection(db, 'listas'), {
      nome,
      membros: [auth.currentUser.uid],
      criadoPor: auth.currentUser.uid,
      criadoEm: serverTimestamp(),
    }).catch((error) => {
      console.error('Erro ao criar lista:', error);
    });

    fecharModal();
  };

  const abrirLista = (lista) => {
    navigation.navigate('DetalheLista', {
      listaId: lista.id,
      listaNome: lista.nome,
    });
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Minhas Listas</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Configuracoes')}
            activeOpacity={0.8}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <PersistentFade visible={temListasPendentesDebounced} style={styles.syncBanner}>
        <Text style={styles.syncBannerText}>
          ☁️ Alterações pendentes de sincronização
        </Text>
      </PersistentFade>

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: QUANTIDADE_CARDS_SKELETON }).map((_, indice) => (
            <View key={indice} style={styles.card}>
              <SkeletonBlock
                width="55%"
                height={18}
                borderRadius={4}
                style={styles.skeletonTitulo}
              />
              <SkeletonBlock width="30%" height={14} borderRadius={4} />
            </View>
          ))}
        </View>
      ) : erro ? (
        <FadeInView style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{erro}</Text>
        </FadeInView>
      ) : listas.length === 0 ? (
        <FadeInView style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Você ainda não tem nenhuma lista.{'\n'}Toque no + para criar a primeira.
          </Text>
        </FadeInView>
      ) : (
        <FadeInView style={styles.listaContainer}>
          <FlatList
            data={listas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <ListaCard lista={item} onPress={abrirLista} />}
          />
        </FadeInView>
      )}

      <TouchableOpacity
        style={[styles.fabSecundario, { bottom: 28 + insets.bottom }]}
        onPress={() => navigation.navigate('EntrarLista')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabSecundarioIcon}>🔑</Text>
      </TouchableOpacity>

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
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={criarLista}
                disabled={!novaListaNome.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonConfirmText}>Criar</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
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
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  syncBannerText: {
    fontSize: 13,
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
  listaContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  skeletonTitulo: {
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIconText: {
    fontSize: 22,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1D',
  },
  cardData: {
    fontSize: 12,
    color: '#9B9B9B',
    marginTop: 2,
    minHeight: 15,
  },
  badgeConcluida: {
    backgroundColor: '#EAF7F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeConcluidaTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D9E75',
  },
  progressoContainer: {
    height: 28,
    marginTop: 10,
    justifyContent: 'center',
  },
  progressoTrilha: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressoPreenchido: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1D9E75',
  },
  progressoTexto: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  badgeMembros: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeMembrosTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  cardTotalEstimado: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D1D1D',
  },
  cardSyncSlot: {
    height: 15,
    marginTop: 6,
  },
  cardSyncTexto: {
    fontSize: 11,
    color: '#9B9B9B',
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
  fabSecundario: {
    position: 'absolute',
    right: 92,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  fabSecundarioIcon: {
    fontSize: 20,
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
