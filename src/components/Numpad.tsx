import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Delete, Eraser } from 'lucide-react-native';
import { colors, radius, shadow } from '@/lib/theme';

interface Props {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'back'],
] as const;

type Variant = 'default' | 'muted' | 'clear';

function tap() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
}

/** Teclado numérico con el mismo diseño del de escritorio (components/ui/numpad.tsx). */
export function Numpad({ onDigit, onBackspace, onClear, disabled }: Props) {
  return (
    <LinearGradient colors={['#F9FAFB', '#FBFBFC']} style={styles.container}>
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => {
            const variant: Variant = key === 'clear' ? 'clear' : key === 'back' ? 'muted' : 'default';
            return (
              <Pressable
                key={key}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={key === 'clear' ? 'Vaciar todo' : key === 'back' ? 'Borrar' : key}
                onPress={() => {
                  tap();
                  if (key === 'clear') onClear();
                  else if (key === 'back') onBackspace();
                  else onDigit(key);
                }}
                style={({ pressed }) => [
                  styles.key,
                  VARIANT[variant],
                  pressed && PRESSED[variant],
                  disabled && styles.disabled,
                ]}
              >
                {key === 'back' ? (
                  <Delete size={28} color={colors.mutedForeground} />
                ) : key === 'clear' ? (
                  <Eraser size={24} color={colors.amber} />
                ) : (
                  <Text style={styles.digit}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 8,
    ...shadow.sm,
  },
  row: { flexDirection: 'row', gap: 8 },
  key: {
    flex: 1,
    height: 50,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  disabled: { opacity: 0.4 },
  digit: { fontSize: 24, fontWeight: '600', color: colors.foreground },
});

const VARIANT = StyleSheet.create({
  default: { backgroundColor: colors.card, borderColor: colors.border },
  muted: { backgroundColor: colors.secondary, borderColor: 'transparent' },
  clear: { backgroundColor: colors.secondary, borderColor: 'transparent' },
});

const PRESSED = StyleSheet.create({
  default: { backgroundColor: colors.accent, borderColor: '#80B5AD', transform: [{ scale: 0.96 }] },
  muted: { backgroundColor: colors.accent, transform: [{ scale: 0.96 }] },
  clear: { backgroundColor: '#FFFBEB', transform: [{ scale: 0.96 }] },
});
