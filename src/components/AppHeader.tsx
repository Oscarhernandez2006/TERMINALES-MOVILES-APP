import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Home, LogOut } from 'lucide-react-native';
import { Brand } from '@/components/Brand';
import { useAuth } from '@/features/auth/auth-context';
import { colors, radius, shadow } from '@/lib/theme';

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

/** Barra superior equivalente a la de escritorio (components/layout/AppShell.tsx). */
export function AppHeader({ title, showHome }: { title?: string; showHome?: boolean }) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  function confirmLogout() {
    if (Platform.OS === 'web') {
      void logout();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Deseás salir de la terminal?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Brand size="sm" />
        {showHome && (
          <Pressable
            accessibilityLabel="Inicio"
            onPress={() => router.dismissTo('/')}
            style={({ pressed }) => [styles.barBtn, styles.iconOnly, pressed && styles.pressed]}
          >
            <Home size={20} color={colors.foreground} />
          </Pressable>
        )}
        <View style={styles.right}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user ? initials(user.fullName) : '—'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={confirmLogout}
            style={({ pressed }) => [styles.barBtn, pressed && styles.pressed]}
          >
            <LogOut size={20} color={colors.mutedForeground} />
            <Text style={styles.barText}>Salir</Text>
          </Pressable>
        </View>
      </View>
      {title && (
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadow.sm,
  },
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  barBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  iconOnly: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  pressed: { backgroundColor: colors.accent },
  barText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  titleRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 17, fontWeight: '600', color: colors.foreground },
});
