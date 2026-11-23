// Equivalentes hex exactos de los tokens oklch de la app de escritorio (apps/web/src/index.css).
export const colors = {
  background: '#FBFCFD',
  foreground: '#131922',
  card: '#FFFFFF',
  primary: '#006B5B',
  primaryPressed: '#005C4D',
  primaryForeground: '#F8FDFC',
  primarySoft: '#E6F0EF', // primary/10 sobre blanco
  primaryTint: '#F2F8F7', // primary/5 sobre blanco
  secondary: '#F4F5F7',
  muted: '#F4F5F7',
  mutedForeground: '#6C727B',
  accent: '#F0F2F4',
  destructive: '#DF2225',
  success: '#1C985A',
  warning: '#E38F00',
  border: '#B4B7BD',
  sidebar: '#0D352F',
  // Fondo del panel de acceso (bg-muted/40 sobre background).
  loginBackground: '#F8F9FA',
  // Texto de la marca "SIGPRO".
  brand: '#1F2937',
  amber: '#D97706',
  red200: '#FECACA',
  red700: '#B91C1C',
  green200: '#BBF7D0',
  green50: '#F0FDF4',
} as const;

export const fonts = {
  bold: 'Montserrat_700Bold',
  extraBold: 'Montserrat_800ExtraBold',
} as const;

// --radius: 0.65rem (unos 10px) y sus derivados de Tailwind.
export const radius = { sm: 6, md: 8, lg: 10, xl: 14, '2xl': 16, '3xl': 24, full: 999 } as const;

export const shadow = {
  sm: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  xl: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
} as const;