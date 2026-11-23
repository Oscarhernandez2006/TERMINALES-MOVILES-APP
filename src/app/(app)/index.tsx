import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ChevronRight, ClipboardCheck, PackageSearch, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/features/auth/auth-context';
import { colors, radius } from '@/lib/theme';

interface Modulo {
  key: string;
  label: string;
  descripcion: string;
  icon: LucideIcon;
  proximamente?: boolean;
  ruta?: Href;
}

// Módulos de la terminal; se habilitan a medida que se construyan.
const MODULOS: Modulo[] = [
  { key: 'punteo', label: 'Punteo', descripcion: 'Verificar producto escaneando sus etiquetas', icon: ClipboardCheck, proximamente: true },
  { key: 'picking', label: 'Picking', descripcion: 'Alistar despachos posta y traslados', icon: PackageSearch, ruta: '/picking' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>
        Hola{firstName ? `, ${firstName}` : ''}. ¿A qué módulo vas?
      </Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Terminal móvil</Text>
        <View style={{ gap: 8 }}>
          {MODULOS.map((m) => (
            <Fila key={m.key} item={m} onPress={() => m.ruta && router.push(m.ruta)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** Igual que la fila del menú de módulos de escritorio (components/layout/MenuModulos.tsx). */
function Fila({ item, onPress }: { item: Modulo; onPress: () => void }) {
  const Icono = item.icon;
  return (
    <Pressable
      disabled={item.proximamente}
      onPress={onPress}
      style={({ pressed }) => [styles.fila, item.proximamente ? styles.filaProx : pressed && styles.filaPressed]}
    >
      <Icono size={28} color="rgba(19,25,34,0.8)" />
      <View style={{ flex: 1 }}>
        <Text style={styles.filaLabel}>{item.label}</Text>
        <Text style={styles.filaDesc}>{item.descripcion}</Text>
      </View>
      {item.proximamente ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Próximamente</Text>
        </View>
      ) : (
        <ChevronRight size={20} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 20, gap: 16 },
  h1: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3, color: colors.foreground },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  panelTitle: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 4 },
  fila: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(244,245,247,0.4)',
  },
  filaPressed: { borderColor: 'rgba(0,107,91,0.4)', backgroundColor: colors.primarySoft },
  filaProx: { borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'rgba(244,245,247,0.2)', opacity: 0.7 },
  filaLabel: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  filaDesc: { fontSize: 14, lineHeight: 19, color: colors.mutedForeground, marginTop: 2 },
  badge: { backgroundColor: '#FEF3C7', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
});
