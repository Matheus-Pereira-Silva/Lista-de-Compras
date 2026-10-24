import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';

import { auth, db } from '../services/firebase';
import { useOffline } from '../hooks/useOffline';
import theme from '../theme';
import produtosLocaisRaw from '../data/produtos.json';
import { FadeInView, SkeletonBlock } from '../components/SkeletonCard';
import { PersistentFade } from '../components/FadePresence';
import ConfirmDialog from '../components/ConfirmDialog';
import { useDebouncedTrue } from '../hooks/useDebouncedTrue';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabled) {
  UIManager.setLayoutAnimationEnabled(true);
}

const formatarPreco = (valor) => `R$ ${valor.toFixed(2).replace('.', ',')}`;
const QUANTIDADE_ITENS_SKELETON = 5;

// Sem 0/O/1/I pra não confundir na hora de digitar o código à mão.
const CARACTERES_CODIGO_CONVITE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const URL_BASE_CONVITE = 'https://listacompras-c4c86.web.app/convite';

function gerarCodigoConvite() {
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    const indice = Math.floor(Math.random() * CARACTERES_CODIGO_CONVITE.length);
    codigo += CARACTERES_CODIGO_CONVITE[indice];
  }
  return codigo;
}

// Enquanto o id está no conjunto de "em transição" (ver alternarStatus),
// a ordenação ignora o status novo e trata o item como se ainda
// estivesse no grupo anterior — é isso que atrasa a troca de grupo sem
// atrasar a escrita no Firestore nem o riscado/desmarcado do item.
function statusEfetivo(item, idsTransicionando) {
  if (!idsTransicionando.has(item.id)) return item.status;
  return item.status === 'comprado' ? 'pendente' : 'comprado';
}

// Pendentes primeiro, comprados no fim; dentro de cada grupo, do mais
// antigo pro mais novo. Itens recém-criados offline ainda não tem
// criadoEm resolvido pelo servidor (vem null) — tratamos como o mais
// recente do grupo, então vão pro fim dele.
function ordenarItens(itens, idsTransicionando) {
  return [...itens].sort((a, b) => {
    const aComprado = statusEfetivo(a, idsTransicionando) === 'comprado' ? 1 : 0;
    const bComprado = statusEfetivo(b, idsTransicionando) === 'comprado' ? 1 : 0;
    if (aComprado !== bComprado) return aComprado - bComprado;

    const tempoA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : null;
    const tempoB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : null;
    if (tempoA == null && tempoB == null) return 0;
    if (tempoA == null) return 1;
    if (tempoB == null) return -1;
    return tempoA - tempoB;
  });
}

const UNIDADES = [
  { valor: 'un', icone: '📦' },
  { valor: 'kg', icone: '⚖️' },
  { valor: 'g', icone: '⚖️' },
  { valor: 'L', icone: '🧴' },
  { valor: 'ml', icone: '🧴' },
  { valor: 'dz', icone: '🥚' },
];

const MAX_RESULTADOS_LOCAIS = 15;

function normalizarTexto(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Banco local de produtos comuns: busca instantânea, sem rede, sem loading —
// é a primeira linha de defesa contra latência/indisponibilidade da API externa.
const produtosLocais = produtosLocaisRaw.map((produto) => ({
  ...produto,
  nomeNormalizado: normalizarTexto(produto.nome),
}));

function buscarProdutosLocais(termo) {
  const termoNormalizado = normalizarTexto(termo);
  if (!termoNormalizado) return [];

  return produtosLocais
    .filter((produto) => produto.nomeNormalizado.includes(termoNormalizado))
    .slice(0, MAX_RESULTADOS_LOCAIS);
}

// Encapsula o fallback offline: se a imagem falhar ao carregar (sem cache e
// sem internet), mostra um placeholder cinza em vez de deixar espaço vazio
// ou o ícone quebrado padrão.
function ImagemProduto({ uri, style }) {
  const [erro, setErro] = useState(false);
  const semImagem = !uri || erro;

  return (
    <View style={[style, semImagem && styles.itemImagemBoxVazia]}>
      {semImagem ? (
        <Ionicons name="basket-outline" size={20} color={theme.colors.primary} />
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

// Componente próprio (em vez de inline no renderItem) porque cada item
// precisa do seu próprio estado local de debounce do indicador de
// sincronização — hooks só funcionam de forma confiável dentro de um
// componente de verdade, não numa função de callback qualquer.
function ItemCard({ item, onAlternarStatus, onEditar }) {
  const pendenteDebounced = useDebouncedTrue(!!item.pendenteSincronizacao, 400);
  const comprado = item.status === 'comprado';

  return (
    <View style={styles.itemCard}>
      <TouchableOpacity
        style={[styles.checkbox, comprado && styles.checkboxChecked]}
        onPress={() => onAlternarStatus(item)}
        activeOpacity={0.8}
        accessibilityLabel={comprado ? 'Marcar como pendente' : 'Marcar como comprado'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: comprado }}
      >
        {comprado && (
          <Ionicons name="checkmark" size={16} color={theme.colors.textOnPrimary} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.itemCardConteudo}
        onPress={() => onEditar(item)}
        activeOpacity={0.7}
      >
        {item.icone ? (
          <View style={styles.itemImagemBox}>
            <Text style={styles.placeholderIcon}>{item.icone}</Text>
          </View>
        ) : (
          <ImagemProduto uri={item.imagemUrl} style={styles.itemImagemBox} />
        )}

        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemNome, comprado && styles.itemTextComprado]}
            numberOfLines={2}
          >
            {item.nome}
          </Text>
          <Text style={[styles.itemDetalhe, comprado && styles.itemTextComprado]}>
            {item.quantidade}
            {item.categoria ? (
              <>
                {'  '}
                <Ionicons
                  name="pricetag-outline"
                  size={11}
                  color={comprado ? theme.colors.textDisabled : theme.colors.textSecondary}
                />
                {' ' + item.categoria}
              </>
            ) : (
              ''
            )}
          </Text>
          {/* Altura sempre reservada — só a opacidade do texto alterna, pra
              não fazer o card crescer/encolher quando a sincronização muda. */}
          <PersistentFade
            visible={pendenteDebounced}
            slide={false}
            style={[styles.itemSincronizandoSlot, styles.linhaComIcone]}
          >
            <Ionicons name="time-outline" size={11} color={theme.colors.textPlaceholder} />
            <Text style={styles.itemSincronizandoTexto}> Sincronizando...</Text>
          </PersistentFade>
        </View>

        {typeof item.preco === 'number' && (
          <Text style={[styles.itemPreco, comprado && styles.itemTextComprado]}>
            {formatarPreco(item.preco)}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function DetalheListaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { listaId, listaNome } = route.params || {};
  const insets = useSafeAreaInsets();
  // Enquanto a faixa global de offline está montada, ela já soma
  // insets.top (ver AppNavigator) — não soma de novo aqui.
  const offline = useOffline();

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(null);

  const [listaAtual, setListaAtual] = useState(null);
  const [erroListaAtual, setErroListaAtual] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [etapa, setEtapa] = useState('busca'); // 'busca' | 'formulario'
  const [itemEditando, setItemEditando] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [iconeSelecionado, setIconeSelecionado] = useState(null);
  const [nome, setNome] = useState('');
  const [quantidadeNumero, setQuantidadeNumero] = useState(1);
  const [unidade, setUnidade] = useState('un');
  const [categoria, setCategoria] = useState('');
  const [precoCentavos, setPrecoCentavos] = useState(null);

  const [renomeioVisible, setRenomeioVisible] = useState(false);
  const [novoNomeLista, setNovoNomeLista] = useState('');

  // Confirmação genérica (substitui Alert.alert) — guarda os dados da
  // ação pendente; um único <ConfirmDialog> no JSX reflete esse estado.
  const [confirmacao, setConfirmacao] = useState(null);
  const fecharConfirmacao = () => setConfirmacao(null);
  const confirmarAcao = () => {
    confirmacao?.onConfirmar();
    fecharConfirmacao();
  };

  // Ids de itens que acabaram de ser marcados/desmarcados e ainda não
  // devem mudar de grupo na lista (ver alternarStatus). timersRef guarda
  // o timeout de cada um, pra poder cancelar se o usuário tocar de novo.
  const [idsTransicionando, setIdsTransicionando] = useState(() => new Set());
  const timersRef = useRef(new Map());
  const [mostrarComprados, setMostrarComprados] = useState(true);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timersRef.current.clear();
    };
  }, []);

  // Busca local: puramente síncrona (array de 200 produtos), sem debounce
  // nem estado de loading — é instantânea por definição.
  const resultadosLocais = useMemo(
    () => buscarProdutosLocais(searchTerm),
    [searchTerm]
  );

  useEffect(() => {
    const itensQuery = query(
      collection(db, 'listas', listaId, 'itens'),
      orderBy('criadoEm', 'asc')
    );

    const unsubscribe = onSnapshot(
      itensQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const dados = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
          // hasPendingWrites do próprio documento (não da query inteira):
          // true enquanto essa escrita local ainda não foi confirmada pelo
          // servidor.
          pendenteSincronizacao: docSnapshot.metadata.hasPendingWrites,
        }));
        // A ordenação (com o atraso de grupo) é recalculada depois, num
        // useMemo que também depende de idsTransicionando — aqui só guarda
        // os dados crus. A animação de reordenar por causa do timer fica
        // a cargo do próprio timer, não daqui.
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItens(dados);
        setErroCarregamento(null);
        setLoading(false);
      },
      (error) => {
        // Sem esse callback, um erro do onSnapshot (ex: regras do Firestore
        // em modo de teste expirando e passando a responder
        // "permission-denied") derrubava o app inteiro sem aviso — foi
        // exatamente isso que causou o crash logo após login/cadastro.
        console.error('Erro ao carregar itens:', error);
        setErroCarregamento(
          error.code === 'firestore/permission-denied'
            ? 'Sem permissão para acessar os dados.'
            : 'Não foi possível carregar. Tente novamente.'
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [listaId]);

  // Dados do documento da própria lista (membros, criadoPor, codigoConvite)
  // — necessários pra saber se o usuário é o dono e pra mostrar/reaproveitar
  // o código de convite.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'listas', listaId),
      (snapshot) => {
        setListaAtual(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setErroListaAtual(null);
      },
      (error) => {
        console.error('Erro ao carregar dados da lista:', error);
        setErroListaAtual('Não foi possível carregar algumas informações da lista.');
      }
    );

    return unsubscribe;
  }, [listaId]);

  const ehDono = listaAtual?.criadoPor === auth.currentUser?.uid;
  const nomeExibido = listaAtual?.nome ?? listaNome;

  // Baseado no status real (sem o atraso da transição) — o total some um
  // item da conta na hora que ele é marcado, mesmo antes de ele subir de
  // grupo visualmente.
  const totalEstimado = itens
    .filter((item) => item.status !== 'comprado' && typeof item.preco === 'number')
    .reduce((total, item) => total + item.preco, 0);

  const temItensPendentes = itens.some((item) => item.pendenteSincronizacao);
  const temItensPendentesDebounced = useDebouncedTrue(temItensPendentes, 400);

  const itensOrdenados = useMemo(
    () => ordenarItens(itens, idsTransicionando),
    [itens, idsTransicionando]
  );

  const totalComprados = itensOrdenados.filter(
    (item) => statusEfetivo(item, idsTransicionando) === 'comprado'
  ).length;

  // Insere o cabeçalho "Comprados (N)" antes do primeiro item do grupo, e
  // some com os itens do grupo (mas não com o cabeçalho) quando recolhido.
  const linhasLista = useMemo(() => {
    const linhas = [];
    let cabecalhoInserido = false;

    itensOrdenados.forEach((item) => {
      const comprado = statusEfetivo(item, idsTransicionando) === 'comprado';

      if (comprado && !cabecalhoInserido) {
        linhas.push({ id: '__cabecalhoComprados', __tipo: 'cabecalhoComprados' });
        cabecalhoInserido = true;
      }

      if (comprado && !mostrarComprados) return;

      linhas.push(item);
    });

    return linhas;
  }, [itensOrdenados, idsTransicionando, mostrarComprados]);

  const alternarMostrarComprados = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMostrarComprados((atual) => !atual);
  };

  const resetarFormulario = () => {
    setEtapa('busca');
    setSearchTerm('');
    setIconeSelecionado(null);
    setNome('');
    setQuantidadeNumero(1);
    setUnidade('un');
    setCategoria('');
    setPrecoCentavos(null);
    setItemEditando(null);
  };

  const abrirModal = () => {
    resetarFormulario();
    setModalVisible(true);
  };

  const fecharModal = () => {
    setModalVisible(false);
    setItemEditando(null);
  };

  // Extrai o número da quantidade salva (ex: "2 kg" -> 2, "kg"), pra
  // preencher o stepper e os chips de unidade na edição.
  const abrirEdicaoItem = (item) => {
    const partes = /^(\d+)\s*(.*)$/.exec(item.quantidade || '');
    setItemEditando(item);
    setIconeSelecionado(item.icone || null);
    setNome(item.nome || '');
    setQuantidadeNumero(partes ? parseInt(partes[1], 10) : 1);
    setUnidade(partes && partes[2] ? partes[2] : 'un');
    setCategoria(item.categoria || '');
    setPrecoCentavos(typeof item.preco === 'number' ? Math.round(item.preco * 100) : null);
    setEtapa('formulario');
    setModalVisible(true);
  };

  const selecionarProdutoLocal = (produto) => {
    setNome(produto.nome);
    setCategoria(produto.categoria);
    setUnidade(produto.unidadeComum);
    setIconeSelecionado(produto.icone);
    setEtapa('formulario');
  };

  const adicionarManualmente = () => {
    setIconeSelecionado(null);
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

  const criarItem = () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return;

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
    if (iconeSelecionado) {
      novoItem.icone = iconeSelecionado;
    }

    // Não aguarda a promise: o Firestore aplica a escrita localmente na
    // hora (Optimistic UI) e sincroniza em segundo plano. Offline, essa
    // promise só resolveria quando a rede voltasse — esperar por ela aqui
    // deixaria o modal preso em "Salvando..." indefinidamente.
    addDoc(collection(db, 'listas', listaId, 'itens'), novoItem).catch((error) => {
      console.error('Erro ao criar item:', error);
    });
  };

  const editarItem = () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return;

    const categoriaTrim = categoria.trim();
    // deleteField() remove o campo se o usuário limpou um valor que já
    // existia (diferente da criação, onde o campo simplesmente não é
    // incluído no documento).
    const dadosAtualizados = {
      nome: nomeTrim,
      quantidade: `${quantidadeNumero} ${unidade}`,
      categoria: categoriaTrim ? categoriaTrim : deleteField(),
      preco: precoCentavos != null ? precoCentavos / 100 : deleteField(),
      icone: iconeSelecionado ? iconeSelecionado : deleteField(),
    };

    updateDoc(doc(db, 'listas', listaId, 'itens', itemEditando.id), dadosAtualizados).catch(
      (error) => console.error('Erro ao editar item:', error)
    );
  };

  const salvarItem = () => {
    if (itemEditando) {
      editarItem();
    } else {
      criarItem();
    }
    fecharModal();
  };

  const excluirItem = (item) => {
    setConfirmacao({
      titulo: 'Excluir item',
      mensagem: `Remover "${item.nome}" da lista?`,
      textoConfirmar: 'Excluir',
      destrutivo: true,
      onConfirmar: () => {
        deleteDoc(doc(db, 'listas', listaId, 'itens', item.id)).catch((error) =>
          console.error('Erro ao excluir item:', error)
        );
        fecharModal();
      },
    });
  };

  const ATRASO_TROCA_DE_GRUPO = 1200;

  const alternarStatus = async (item) => {
    const novoStatus = item.status === 'comprado' ? 'pendente' : 'comprado';

    if (timersRef.current.has(item.id)) {
      // Segundo toque antes do timer da transição anterior terminar: o
      // item já está de volta ao status original, então não há troca de
      // grupo pendente — só cancela o timer, sem reordenar nada.
      clearTimeout(timersRef.current.get(item.id));
      timersRef.current.delete(item.id);
      setIdsTransicionando((atual) => {
        const novo = new Set(atual);
        novo.delete(item.id);
        return novo;
      });
    } else {
      setIdsTransicionando((atual) => new Set(atual).add(item.id));
      const timeoutId = setTimeout(() => {
        timersRef.current.delete(item.id);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIdsTransicionando((atual) => {
          const novo = new Set(atual);
          novo.delete(item.id);
          return novo;
        });
      }, ATRASO_TROCA_DE_GRUPO);
      timersRef.current.set(item.id, timeoutId);
    }

    // Grava na hora, como as outras escritas — o riscado/desmarcado do
    // item já reflete isso imediatamente via onSnapshot; só a posição na
    // lista é que fica atrasada (ver statusEfetivo/ordenarItens acima).
    try {
      await updateDoc(doc(db, 'listas', listaId, 'itens', item.id), {
        status: novoStatus,
      });
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  };

  const compartilharLista = () => {
    let codigo = listaAtual?.codigoConvite;

    if (!codigo) {
      codigo = gerarCodigoConvite();
      // Fogo e esquece, igual as outras escritas: o código já é usado no
      // Share abaixo sem esperar a confirmação do servidor.
      setDoc(doc(db, 'convites', codigo), {
        listaId,
        criadoPor: auth.currentUser.uid,
        criadoEm: serverTimestamp(),
      }).catch((error) => console.error('Erro ao criar convite:', error));

      updateDoc(doc(db, 'listas', listaId), { codigoConvite: codigo }).catch((error) =>
        console.error('Erro ao salvar código de convite na lista:', error)
      );
    }

    const link = `${URL_BASE_CONVITE}/${codigo}`;
    Share.share({
      message: `Entre na minha lista "${nomeExibido}" no Lista de Compras: ${link} (código: ${codigo})`,
    }).catch((error) => console.error('Erro ao abrir compartilhamento:', error));
  };

  const revogarConvite = () => {
    const codigo = listaAtual?.codigoConvite;
    if (!codigo) return;

    setConfirmacao({
      titulo: 'Revogar convite',
      mensagem: 'O código atual deixará de funcionar. Você pode gerar um novo depois.',
      textoConfirmar: 'Revogar',
      destrutivo: true,
      onConfirmar: () => {
        deleteDoc(doc(db, 'convites', codigo)).catch((error) =>
          console.error('Erro ao revogar convite:', error)
        );
        updateDoc(doc(db, 'listas', listaId), { codigoConvite: deleteField() }).catch(
          (error) => console.error('Erro ao limpar código de convite:', error)
        );
      },
    });
  };

  const sairDaLista = () => {
    setConfirmacao({
      titulo: 'Sair da lista',
      mensagem: `Você vai deixar de ver "${nomeExibido}".`,
      textoConfirmar: 'Sair',
      destrutivo: true,
      onConfirmar: () => {
        updateDoc(doc(db, 'listas', listaId), {
          membros: arrayRemove(auth.currentUser.uid),
        }).catch((error) => console.error('Erro ao sair da lista:', error));
        navigation.goBack();
      },
    });
  };

  const abrirRenomearLista = () => {
    setNovoNomeLista(nomeExibido ?? '');
    setRenomeioVisible(true);
  };

  const fecharRenomearLista = () => {
    setRenomeioVisible(false);
  };

  const confirmarRenomeio = () => {
    const nomeTrim = novoNomeLista.trim();
    if (!nomeTrim) return;

    updateDoc(doc(db, 'listas', listaId), { nome: nomeTrim }).catch((error) =>
      console.error('Erro ao renomear lista:', error)
    );
    fecharRenomearLista();
  };

  const excluirLista = () => {
    setConfirmacao({
      titulo: 'Excluir lista',
      mensagem: `Isso vai apagar "${nomeExibido}" e todos os itens dela para todos os membros. Essa ação não pode ser desfeita.`,
      textoConfirmar: 'Excluir',
      destrutivo: true,
      onConfirmar: () => {
        // Mesmo padrão fogo-e-esquece: não aguarda o commit do batch,
        // só sai da tela — o Firestore aplica localmente e sincroniza
        // quando a conexão voltar.
        const batch = writeBatch(db);
        itens.forEach((item) => {
          batch.delete(doc(db, 'listas', listaId, 'itens', item.id));
        });
        if (listaAtual?.codigoConvite) {
          batch.delete(doc(db, 'convites', listaAtual.codigoConvite));
        }
        batch.delete(doc(db, 'listas', listaId));
        batch.commit().catch((error) => console.error('Erro ao excluir lista:', error));
        navigation.goBack();
      },
    });
  };

  const abrirMenuLista = () => {
    const opcoes = [{ text: 'Renomear lista', onPress: abrirRenomearLista }];
    if (ehDono) {
      opcoes.push({ text: 'Excluir lista', style: 'destructive', onPress: excluirLista });
    }
    opcoes.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Opções da lista', undefined, opcoes);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (offline ? 0 : insets.top) + 16 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Voltar"
          >
            <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {nomeExibido}
          </Text>
          <View style={styles.headerActions}>
            {ehDono ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={compartilharLista}
                activeOpacity={0.8}
                accessibilityLabel="Compartilhar lista"
              >
                <Ionicons name="share-social-outline" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.backButton}
                onPress={sairDaLista}
                activeOpacity={0.8}
                accessibilityLabel="Sair da lista"
              >
                <Ionicons name="exit-outline" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.backButton}
              onPress={abrirMenuLista}
              activeOpacity={0.8}
              accessibilityLabel="Mais opções da lista"
            >
              <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Linha fina, sem pill — só alterna opacidade (altura sempre a
            mesma), pra não deixar buraco no espaçamento quando não há
            pendência nem gerar salto quando aparece. */}
        <PersistentFade
          visible={temItensPendentesDebounced}
          slide={false}
          style={[styles.headerSyncLinha, styles.linhaComIcone]}
        >
          <Ionicons name="cloud-outline" size={12} color={theme.colors.textPlaceholder} />
          <Text style={styles.headerSyncTexto}> Alterações pendentes de sincronização</Text>
        </PersistentFade>
      </View>

      {erroListaAtual && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>{erroListaAtual}</Text>
        </View>
      )}

      {ehDono && listaAtual?.codigoConvite && (
        <View style={styles.codigoBanner}>
          <Text style={styles.codigoBannerTexto}>
            Código de convite: <Text style={styles.codigoBannerCodigo}>{listaAtual.codigoConvite}</Text>
          </Text>
          <TouchableOpacity onPress={revogarConvite} activeOpacity={0.7}>
            <Text style={styles.codigoBannerRevogar}>Revogar</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total estimado (pendentes)</Text>
        {loading ? (
          <SkeletonBlock width={120} height={26} borderRadius={6} />
        ) : (
          <Text style={styles.totalValue}>{formatarPreco(totalEstimado)}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: QUANTIDADE_ITENS_SKELETON }).map((_, indice) => (
            <View key={indice} style={styles.itemCard}>
              <SkeletonBlock
                width={26}
                height={26}
                borderRadius={13}
                style={styles.skeletonCheckbox}
              />
              <SkeletonBlock
                width={44}
                height={44}
                borderRadius={12}
                style={styles.skeletonImagem}
              />
              <View style={styles.itemInfo}>
                <SkeletonBlock
                  width="70%"
                  height={16}
                  borderRadius={4}
                  style={styles.skeletonNome}
                />
                <SkeletonBlock width="40%" height={12} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      ) : erroCarregamento ? (
        <FadeInView style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{erroCarregamento}</Text>
        </FadeInView>
      ) : itens.length === 0 ? (
        <FadeInView style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="basket-outline" size={36} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sua lista está vazia</Text>
          <Text style={styles.emptyText}>Adicione o primeiro item para começar.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={abrirModal} activeOpacity={0.8}>
            <Text style={styles.emptyButtonText}>Adicionar item</Text>
          </TouchableOpacity>
        </FadeInView>
      ) : (
        <FadeInView style={styles.listaContainer}>
          <FlatList
            data={linhasLista}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) =>
              item.__tipo === 'cabecalhoComprados' ? (
                <TouchableOpacity
                  onPress={alternarMostrarComprados}
                  activeOpacity={0.7}
                  style={[styles.cabecalhoComprados, styles.linhaComIcone]}
                  accessibilityLabel={mostrarComprados ? 'Recolher comprados' : 'Expandir comprados'}
                >
                  <Ionicons
                    name={mostrarComprados ? 'chevron-down' : 'chevron-forward'}
                    size={14}
                    color={theme.colors.textPlaceholder}
                  />
                  <Text style={styles.cabecalhoCompradosTexto}>
                    {' '}Comprados ({totalComprados})
                  </Text>
                </TouchableOpacity>
              ) : (
                <ItemCard item={item} onAlternarStatus={alternarStatus} onEditar={abrirEdicaoItem} />
              )
            }
          />
        </FadeInView>
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={abrirModal}
        activeOpacity={0.8}
        accessibilityLabel="Adicionar item"
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
          <View style={styles.modalContent}>
            {etapa === 'busca' ? (
              <>
                <Text style={styles.modalTitle}>Adicionar item</Text>

                <TextInput

                  keyboardAppearance="light"
                  style={styles.modalInput}
                  placeholder="Buscar produto (ex: arroz, leite...)"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  autoFocus
                />

                {resultadosLocais.length > 0 && (
                  <FlatList
                    data={resultadosLocais}
                    keyExtractor={(item) => item.nome}
                    style={styles.searchResultsList}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchResultItem}
                        onPress={() => selecionarProdutoLocal(item)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.searchResultIconBox}>
                          <Text style={styles.searchResultIconText}>
                            {item.icone}
                          </Text>
                        </View>
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultNome} numberOfLines={1}>
                            {item.nome}
                          </Text>
                          <Text
                            style={styles.searchResultCategoria}
                            numberOfLines={1}
                          >
                            {item.categoria}
                          </Text>
                        </View>
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
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.formHeader}>
                  <TouchableOpacity
                    style={[styles.linhaComIcone, styles.formBackButton]}
                    onPress={() => (itemEditando ? fecharModal() : setEtapa('busca'))}
                    activeOpacity={0.7}
                  >
                    {!itemEditando && (
                      <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
                    )}
                    <Text style={styles.formBackText}>
                      {itemEditando ? 'Cancelar' : 'Buscar'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>
                    {itemEditando ? 'Editar item' : 'Novo item'}
                  </Text>
                  <View style={styles.formHeaderSpacer} />
                </View>

                {iconeSelecionado && (
                  <View style={styles.formImagePreviewBox}>
                    <Text style={styles.formIconPreviewText}>
                      {iconeSelecionado}
                    </Text>
                  </View>
                )}

                <TextInput

                  keyboardAppearance="light"
                  style={styles.modalInput}
                  placeholder="Nome do item"
                  placeholderTextColor={theme.colors.textPlaceholder}
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
                  keyboardAppearance="light"
                  style={styles.modalInput}
                  placeholder="Ex: Limpeza"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  value={categoria}
                  onChangeText={setCategoria}
                />

                <Text style={styles.fieldLabel}>Preço (opcional)</Text>
                <TextInput
                  keyboardAppearance="light"
                  style={styles.modalInput}
                  placeholder="R$ 0,00"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  value={precoFormatado}
                  onChangeText={handlePrecoChange}
                  keyboardType="number-pad"
                />

                <View style={[styles.modalActions, itemEditando && styles.modalActionsComExcluir]}>
                  {itemEditando && (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonDestructive]}
                      onPress={() => excluirItem(itemEditando)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalButtonDestructiveText}>Excluir</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={fecharModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={salvarItem}
                    disabled={!nome.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonConfirmText}>
                      {itemEditando ? 'Salvar' : 'Adicionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={renomeioVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharRenomearLista}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Renomear lista</Text>
              <TextInput
                keyboardAppearance="light"
                style={styles.modalInput}
                placeholder="Nome da lista"
                placeholderTextColor={theme.colors.textPlaceholder}
                value={novoNomeLista}
                onChangeText={setNovoNomeLista}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={fecharRenomearLista}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={confirmarRenomeio}
                  disabled={!novoNomeLista.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonConfirmText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={!!confirmacao}
        title={confirmacao?.titulo}
        message={confirmacao?.mensagem}
        confirmLabel={confirmacao?.textoConfirmar}
        destructive={confirmacao?.destrutivo}
        onConfirm={confirmarAcao}
        onCancel={fecharConfirmacao}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Altura pequena e fixa — só a opacidade alterna, nunca o espaço
  // ocupado, pra não deixar buraco quando não há pendência.
  headerSyncLinha: {
    height: 16,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  headerSyncTexto: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPlaceholder,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  codigoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
  },
  codigoBannerTexto: {
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  codigoBannerCodigo: {
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  codigoBannerRevogar: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.error,
    marginLeft: 12,
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
    backgroundColor: theme.colors.backgroundMuted,
  },
  syncBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  totalContainer: {
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryLight,
  },
  totalLabel: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.xl,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textOnPrimary,
  },
  listaContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 110,
  },
  skeletonCheckbox: {
    marginRight: 14,
  },
  skeletonImagem: {
    marginRight: 14,
  },
  skeletonNome: {
    marginBottom: 6,
  },
  cabecalhoComprados: {
    paddingVertical: 6,
    marginBottom: 8,
  },
  cabecalhoCompradosTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPlaceholder,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
  },
  itemCardConteudo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImagemBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 14,
    backgroundColor: theme.colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Círculo verde-claro — só quando não há foto nem emoji de produto.
  itemImagemBoxVazia: {
    backgroundColor: theme.colors.primaryLight,
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
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  itemDetalhe: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  itemSincronizandoSlot: {
    height: 15,
    marginTop: 3,
  },
  // Reaproveitada em toda linha que combina um ícone pequeno com texto.
  linhaComIcone: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSincronizandoTexto: {
    fontSize: 11,
    color: theme.colors.textPlaceholder,
  },
  itemTextComprado: {
    textDecorationLine: 'line-through',
    color: theme.colors.textDisabled,
  },
  itemPreco: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginLeft: 12,
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.fab,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 14,
  },
  searchResultsList: {
    maxHeight: 260,
    marginBottom: 14,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.backgroundMuted,
  },
  searchResultIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultIconText: {
    fontSize: 20,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultNome: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  searchResultCategoria: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  manualLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  manualLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
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
  formBackButton: {
    width: 60,
  },
  formBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  formImagePreviewBox: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: theme.colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  formIconPreviewText: {
    fontSize: 36,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
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
    backgroundColor: theme.colors.backgroundMuted,
  },
  unidadeChipAtiva: {
    backgroundColor: theme.colors.primary,
  },
  unidadeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  unidadeChipTextAtiva: {
    color: theme.colors.textOnPrimary,
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
  modalActionsComExcluir: {
    justifyContent: 'space-between',
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.backgroundMuted,
  },
  modalButtonConfirm: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonDestructive: {
    backgroundColor: theme.colors.errorLight,
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
  modalButtonDestructiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.error,
  },
});
