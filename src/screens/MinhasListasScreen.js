import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { useOffline } from '../hooks/useOffline';
import theme from '../theme';
import { FadeInView, SkeletonBlock } from '../components/SkeletonCard';
import { PersistentFade } from '../components/FadePresence';
import { useDebouncedTrue } from '../hooks/useDebouncedTrue';

const QUANTIDADE_CARDS_SKELETON = 4;

const formatarPreco = (valor) => `R$ ${valor.toFixed(2).replace('.', ',')}`;

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

  const dataTexto = formatarDataCurta(lista.criadoEm);
  const quantidadeMembros = lista.membros?.length ?? 0;

  const pendenteDebounced = useDebouncedTrue(!!lista.pendenteSincronizacao, 400);

  const subtituloPartes = [];
  if (!carregando) {
    subtituloPartes.push(totalItens === 1 ? '1 item' : `${totalItens} itens`);
  }
  if (dataTexto) {
    subtituloPartes.push(`criada em ${dataTexto}`);
  }

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(lista)} activeOpacity={0.8}>
      {/* Ícone sobreposto (não ocupa espaço no fluxo) — some sem deixar
          buraco no card, ao contrário da antiga linha de texto embaixo. */}
      <PersistentFade
        visible={pendenteDebounced}
        slide={false}
        style={styles.cardSyncIcone}
      >
        <Ionicons name="cloud-outline" size={15} color={theme.colors.textPlaceholder} />
      </PersistentFade>

      <View style={styles.cardTopRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {lista.nome}
          </Text>
          {carregando ? (
            erroItens ? (
              <Text style={styles.cardData}>{erroItens}</Text>
            ) : (
              <SkeletonBlock
                width="50%"
                height={12}
                borderRadius={4}
                style={styles.skeletonSubtitulo}
              />
            )
          ) : (
            <Text style={styles.cardData} numberOfLines={1}>
              {subtituloPartes.join(' · ')}
            </Text>
          )}
        </View>

        {!carregando && concluida && (
          <View style={styles.badgeConcluida}>
            <Text style={styles.badgeConcluidaTexto}>Concluída</Text>
          </View>
        )}
      </View>

      {carregando ? (
        !erroItens && (
          <View style={styles.progressoContainer}>
            <SkeletonBlock width="70%" height={10} borderRadius={4} />
          </View>
        )
      ) : totalItens === 0 ? (
        <View style={styles.progressoContainer}>
          <Text style={styles.progressoTexto}>Lista vazia</Text>
        </View>
      ) : (
        <View style={styles.progressoContainer}>
          <View style={styles.progressoTrilha}>
            <View style={[styles.progressoPreenchido, { width: `${progresso * 100}%` }]} />
          </View>
          <Text style={styles.progressoTexto}>
            {totalComprados} de {totalItens} comprados
          </Text>
        </View>
      )}

      {(quantidadeMembros > 1 || (!carregando && temPreco)) && (
        <View style={styles.cardFooterRow}>
          <Text style={styles.cardMembrosTexto}>
            {quantidadeMembros > 1 ? `${quantidadeMembros} pessoas` : ''}
          </Text>
          {!carregando && temPreco && (
            <Text style={styles.cardTotalEstimado}>{formatarPreco(totalEstimado)}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MinhasListasScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Enquanto a faixa global de offline está montada, ela já soma
  // insets.top (ver AppNavigator) — não soma de novo aqui.
  const offline = useOffline();
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
      <View style={[styles.header, { paddingTop: (offline ? 0 : insets.top) + 16 }]}>
        <Text style={styles.title}>Minhas Listas</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Configuracoes')}
            activeOpacity={0.8}
            accessibilityLabel="Configurações"
          >
            <Ionicons name="settings-outline" size={22} color={theme.colors.textPrimary} />
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
        <Ionicons name="cloud-outline" size={14} color={theme.colors.textSecondary} />
        <Text style={styles.syncBannerText}> Alterações pendentes de sincronização</Text>
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
        accessibilityLabel="Entrar com código"
      >
        <Ionicons name="key-outline" size={20} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={abrirModal}
        activeOpacity={0.8}
        accessibilityLabel="Nova lista"
      >
        <Ionicons name="add" size={30} color={theme.colors.textOnPrimary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Nova lista</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nome da lista"
                placeholderTextColor={theme.colors.textPlaceholder}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.heading,
    fontSize: 24,
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md - 2,
  },
  settingsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundMuted,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundMuted,
  },
  syncBannerText: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  listaContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl - 6,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  skeletonTitulo: {
    marginBottom: theme.spacing.sm,
  },
  // Sobreposto (position absolute) — não ocupa espaço no fluxo, então
  // aparecer/sumir nunca deixa buraco no card.
  cardSyncIcone: {
    position: 'absolute',
    top: 10,
    right: theme.spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    paddingRight: theme.spacing.xl,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  cardData: {
    fontSize: 12,
    color: theme.colors.textPlaceholder,
    marginTop: 3,
  },
  skeletonSubtitulo: {
    marginTop: theme.spacing.xs,
  },
  badgeConcluida: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    marginLeft: theme.spacing.sm,
  },
  badgeConcluidaTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  progressoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md - 2,
    marginTop: theme.spacing.md,
  },
  progressoTrilha: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.track,
    overflow: 'hidden',
  },
  progressoPreenchido: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  progressoTexto: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    flexShrink: 0,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  cardMembrosTexto: {
    fontSize: 12,
    color: theme.colors.textPlaceholder,
  },
  cardTotalEstimado: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.fab,
  },
  fabSecundario: {
    position: 'absolute',
    right: 92,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.fabSecundario,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.backgroundMuted,
  },
  modalButtonConfirm: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  modalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textOnPrimary,
  },
});
