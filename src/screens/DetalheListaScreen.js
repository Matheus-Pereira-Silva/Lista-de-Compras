import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '../services/firebase';

const formatarPreco = (valor) => `R$ ${valor.toFixed(2).replace('.', ',')}`;

const UNIDADES = [
  { valor: 'un', icone: '📦' },
  { valor: 'kg', icone: '⚖️' },
  { valor: 'g', icone: '⚖️' },
  { valor: 'L', icone: '🧴' },
  { valor: 'ml', icone: '🧴' },
];

// Encapsula o fallback offline: se a imagem falhar ao carregar (sem cache e
// sem internet), mostra um placeholder cinza em vez de deixar espaço vazio
// ou o ícone quebrado padrão.
function ImagemProduto({ uri, style }) {
  const [erro, setErro] = useState(false);
  const semImagem = !uri || erro;

  return (
    <View style={style}>
      {semImagem ? (
        <Text style={styles.placeholderIcon}>🛒</Text>
      ) : (
        <ExpoImage
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          cachePolicy="disk"
          contentFit="cover"
          transition={150}
          onError={() => setErro(true)}
        />
      )}
    </View>
  );
}

async function buscarProdutosOFF(termo) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    termo
  )}&search_simple=1&action=process&json=1&countries=brazil&page_size=10`;
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'ListaCompras-TCC/1.0 (contato: matheuspereiradasilva08@gmail.com)',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('json')) {
    const corpo = await response.text();
    console.error(
      'Resposta inesperada da API de busca:',
      response.status,
      contentType,
      corpo.slice(0, 300)
    );
    throw new Error('Resposta inesperada da API de busca');
  }

  const data = await response.json();
  return (data.products || [])
    .filter((produto) => produto.product_name)
    .map((produto, index) => ({
      id: produto.code ? String(produto.code) : `idx-${index}`,
      nome: produto.product_name,
      imagemUrl: produto.image_small_url || produto.image_url || null,
    }));
}

export default function DetalheListaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { listaId, listaNome } = route.params || {};
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [etapa, setEtapa] = useState('busca'); // 'busca' | 'formulario'
  const [salvando, setSalvando] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [nome, setNome] = useState('');
  const [quantidadeNumero, setQuantidadeNumero] = useState(1);
  const [unidade, setUnidade] = useState('un');
  const [categoria, setCategoria] = useState('');
  const [precoCentavos, setPrecoCentavos] = useState(null);

  useEffect(() => {
    const itensQuery = query(
      collection(db, 'listas', listaId, 'itens'),
      orderBy('criadoEm', 'asc')
    );

    const unsubscribe = onSnapshot(itensQuery, (snapshot) => {
      const dados = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      setItens(dados);
      setLoading(false);
    });

    return unsubscribe;
  }, [listaId]);

  useEffect(() => {
    const termo = searchTerm.trim();
    if (!termo) {
      setSearchResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let ignorar = false;
    setSearching(true);
    setSearchError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const estadoRede = await NetInfo.fetch();
        if (ignorar) return;

        if (!estadoRede.isConnected) {
          setSearchResults([]);
          setSearchError('Sem conexão — adicione manualmente.');
          return;
        }

        // A busca textual do Open Food Facts tem uma taxa alta de erros 503
        // transitórios sob carga (medimos ~40% em testes) — várias tentativas
        // seguidas reduzem bastante a chance de falha total.
        const MAX_TENTATIVAS = 3;
        let produtos;
        let ultimoErro;
        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
          if (ignorar) return;
          try {
            produtos = await buscarProdutosOFF(termo);
            ultimoErro = null;
            break;
          } catch (erro) {
            ultimoErro = erro;
            if (tentativa < MAX_TENTATIVAS) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }

        if (ignorar) return;
        if (ultimoErro) throw ultimoErro;
        setSearchResults(produtos);
      } catch (error) {
        if (!ignorar) {
          console.error('Erro ao buscar produtos:', error);
          setSearchResults([]);
          setSearchError('Sem conexão — adicione manualmente.');
        }
      } finally {
        if (!ignorar) setSearching(false);
      }
    }, 500);

    return () => {
      ignorar = true;
      clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  const totalEstimado = itens
    .filter((item) => item.status !== 'comprado' && typeof item.preco === 'number')
    .reduce((total, item) => total + item.preco, 0);

  const resetarFormulario = () => {
    setEtapa('busca');
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
    setProdutoSelecionado(null);
    setNome('');
    setQuantidadeNumero(1);
    setUnidade('un');
    setCategoria('');
    setPrecoCentavos(null);
  };

  const abrirModal = () => {
    resetarFormulario();
    setModalVisible(true);
  };

  const fecharModal = () => {
    setModalVisible(false);
  };

  const selecionarProduto = (produto) => {
    setProdutoSelecionado(produto);
    setNome(produto.nome);
    setEtapa('formulario');
  };

  const adicionarManualmente = () => {
    setProdutoSelecionado(null);
    setNome(searchTerm.trim());
    setEtapa('formulario');
  };

  const handlePrecoChange = (texto) => {
    const somenteDigitos = texto.replace(/\D/g, '');
    if (!somenteDigitos) {
      setPrecoCentavos(null);
      return;
    }
    setPrecoCentavos(parseInt(somenteDigitos, 10));
  };

  const precoFormatado =
    precoCentavos != null ? formatarPreco(precoCentavos / 100) : '';

  const criarItem = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return;

    setSalvando(true);
    try {
      const novoItem = {
        nome: nomeTrim,
        quantidade: `${quantidadeNumero} ${unidade}`,
        status: 'pendente',
        criadoPor: auth.currentUser.uid,
        criadoEm: serverTimestamp(),
      };

      const categoriaTrim = categoria.trim();
      if (categoriaTrim) {
        novoItem.categoria = categoriaTrim;
      }
      if (precoCentavos != null) {
        novoItem.preco = precoCentavos / 100;
      }
      if (produtoSelecionado?.imagemUrl) {
        novoItem.imagemUrl = produtoSelecionado.imagemUrl;
      }

      await addDoc(collection(db, 'listas', listaId, 'itens'), novoItem);
      fecharModal();
    } catch (error) {
      console.error('Erro ao criar item:', error);
    } finally {
      setSalvando(false);
    }
  };

  const alternarStatus = async (item) => {
    const novoStatus = item.status === 'comprado' ? 'pendente' : 'comprado';
    try {
      await updateDoc(doc(db, 'listas', listaId, 'itens', item.id), {
        status: novoStatus,
      });
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {listaNome}
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total estimado (pendentes)</Text>
        <Text style={styles.totalValue}>{formatarPreco(totalEstimado)}</Text>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Carregando...</Text>
        </View>
      ) : itens.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhum item ainda.{'\n'}Toque no + para adicionar o primeiro.
          </Text>
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const comprado = item.status === 'comprado';
            return (
              <View style={styles.itemCard}>
                <TouchableOpacity
                  style={[styles.checkbox, comprado && styles.checkboxChecked]}
                  onPress={() => alternarStatus(item)}
                  activeOpacity={0.8}
                >
                  {comprado && <Text style={styles.checkboxIcon}>✓</Text>}
                </TouchableOpacity>

                <ImagemProduto uri={item.imagemUrl} style={styles.itemImagemBox} />

                <View style={styles.itemInfo}>
                  <Text
                    style={[styles.itemNome, comprado && styles.itemTextComprado]}
                    numberOfLines={2}
                  >
                    {item.nome}
                  </Text>
                  <Text
                    style={[styles.itemDetalhe, comprado && styles.itemTextComprado]}
                  >
                    {item.quantidade}
                    {item.categoria ? ` · 🏷️ ${item.categoria}` : ''}
                  </Text>
                </View>

                {typeof item.preco === 'number' && (
                  <Text
                    style={[styles.itemPreco, comprado && styles.itemTextComprado]}
                  >
                    {formatarPreco(item.preco)}
                  </Text>
                )}
              </View>
            );
          }}
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
            {etapa === 'busca' ? (
              <>
                <Text style={styles.modalTitle}>Adicionar item</Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Buscar produto (ex: arroz, leite...)"
                  placeholderTextColor="#9B9B9B"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  autoFocus
                />

                {searching && (
                  <ActivityIndicator
                    color="#1D9E75"
                    style={styles.searchLoading}
                  />
                )}

                {!searching && searchError && (
                  <Text style={styles.searchErrorText}>📡 {searchError}</Text>
                )}

                {!searching && !searchError && searchTerm.trim().length > 0 && (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    style={styles.searchResultsList}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <Text style={styles.searchEmptyText}>
                        Nenhum produto encontrado.
                      </Text>
                    }
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchResultItem}
                        onPress={() => selecionarProduto(item)}
                        activeOpacity={0.8}
                      >
                        <ImagemProduto
                          uri={item.imagemUrl}
                          style={styles.searchResultImageBox}
                        />
                        <Text style={styles.searchResultNome} numberOfLines={2}>
                          {item.nome}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}

                <TouchableOpacity
                  style={styles.manualLink}
                  onPress={adicionarManualmente}
                  activeOpacity={0.7}
                >
                  <Text style={styles.manualLinkText}>Adicionar manualmente</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel, styles.modalButtonFull]}
                  onPress={fecharModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.formHeader}>
                  <TouchableOpacity onPress={() => setEtapa('busca')} activeOpacity={0.7}>
                    <Text style={styles.formBackText}>‹ Buscar</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Novo item</Text>
                  <View style={styles.formHeaderSpacer} />
                </View>

                {produtoSelecionado?.imagemUrl && (
                  <ImagemProduto
                    uri={produtoSelecionado.imagemUrl}
                    style={styles.formImagePreviewBox}
                  />
                )}

                <TextInput
                  style={styles.modalInput}
                  placeholder="Nome do item"
                  placeholderTextColor="#9B9B9B"
                  value={nome}
                  onChangeText={setNome}
                />

                <Text style={styles.fieldLabel}>Quantidade</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setQuantidadeNumero((q) => Math.max(1, q - 1))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.stepperButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{quantidadeNumero}</Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setQuantidadeNumero((q) => q + 1)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Unidade</Text>
                <View style={styles.unidadeChips}>
                  {UNIDADES.map((opcao) => (
                    <TouchableOpacity
                      key={opcao.valor}
                      style={[
                        styles.unidadeChip,
                        unidade === opcao.valor && styles.unidadeChipAtiva,
                      ]}
                      onPress={() => setUnidade(opcao.valor)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.unidadeChipText,
                          unidade === opcao.valor && styles.unidadeChipTextAtiva,
                        ]}
                      >
                        {opcao.icone} {opcao.valor}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Categoria (opcional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: Limpeza"
                  placeholderTextColor="#9B9B9B"
                  value={categoria}
                  onChangeText={setCategoria}
                />

                <Text style={styles.fieldLabel}>Preço (opcional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="R$ 0,00"
                  placeholderTextColor="#9B9B9B"
                  value={precoFormatado}
                  onChangeText={handlePrecoChange}
                  keyboardType="number-pad"
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
                    onPress={criarItem}
                    disabled={salvando || !nome.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonConfirmText}>
                      {salvando ? 'Salvando...' : 'Adicionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backButton: {
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
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1D1D1D',
    textAlign: 'center',
  },
  totalContainer: {
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#EAF7F1',
  },
  totalLabel: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '600',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1D1D1D',
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
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    backgroundColor: '#1D9E75',
  },
  checkboxIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemImagemBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderIcon: {
    fontSize: 18,
  },
  itemInfo: {
    flex: 1,
  },
  itemNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1D',
    marginBottom: 3,
  },
  itemDetalhe: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  itemTextComprado: {
    textDecorationLine: 'line-through',
    color: '#B0B0B0',
  },
  itemPreco: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1D1D1D',
    marginLeft: 12,
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
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1D1D1D',
    marginBottom: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1D1D1D',
    marginBottom: 14,
  },
  searchLoading: {
    marginBottom: 14,
  },
  searchResultsList: {
    maxHeight: 260,
    marginBottom: 14,
  },
  searchEmptyText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingVertical: 16,
  },
  searchErrorText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultImageBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  searchResultNome: {
    flex: 1,
    fontSize: 15,
    color: '#1D1D1D',
  },
  manualLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  manualLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D9E75',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  formHeaderSpacer: {
    width: 60,
  },
  formBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D9E75',
    width: 60,
  },
  formImagePreviewBox: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1D1D1D',
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1D',
    marginHorizontal: 24,
    minWidth: 24,
    textAlign: 'center',
  },
  unidadeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  unidadeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  unidadeChipAtiva: {
    backgroundColor: '#1D9E75',
  },
  unidadeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  unidadeChipTextAtiva: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalButtonFull: {
    alignItems: 'center',
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
