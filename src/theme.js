// Fonte única de verdade pro visual do app — cores, espaçamento, raios,
// sombra e tipografia. Trocar um valor aqui reflete em todas as telas
// que usam o tema em vez de números/hexadecimais soltos.

const colors = {
  primary: '#1D9E75',
  primaryDark: '#17805F',
  primaryLight: '#EAF7F1',

  background: '#FFFFFF',
  backgroundMuted: '#F0F0F0',
  border: '#E0E0E0',
  track: '#E5E5E5',
  overlay: 'rgba(0, 0, 0, 0.4)',

  textPrimary: '#1D1D1D',
  textSecondary: '#6B6B6B',
  textPlaceholder: '#9B9B9B',
  textDisabled: '#B0B0B0',
  textOnPrimary: '#FFFFFF',

  error: '#D14343',
  errorLight: '#FDECEC',
  errorBorder: '#F7D4D4',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  xxl: 20,
  round: 999,
};

const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabSecundario: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
};

const typography = {
  title: { fontSize: 28, fontWeight: 'bold' },
  heading: { fontSize: 20, fontWeight: 'bold' },
  subheading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyBold: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
  tiny: { fontSize: 11, fontWeight: '600' },
};

const theme = { colors, spacing, radius, shadow, typography };

export default theme;
