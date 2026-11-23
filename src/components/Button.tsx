import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, shadow } from '@/lib/theme';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  title?: string;
  children?: React.ReactNode;
  variant?: Variant;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}

/** Botón con los mismos estilos de components/ui/button.tsx de escritorio, en tamaño táctil. */
export function Button({ title, children, variant = 'primary', loading, disabled, icon: Icon, iconRight: IconRight, style, ...rest }: Props) {
  const isDisabled = disabled || loading;
  // Primario deshabilitado se ve gris, no como un verde desvanecido (igual que en escritorio).
  const grisado = isDisabled && (variant === 'primary' || variant === 'danger');
  const fg = grisado ? colors.mutedForeground : FG[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        VARIANTS[variant],
        pressed && !isDisabled && PRESSED[variant],
        grisado && styles.disabled,
        isDisabled && !grisado && { opacity: 0.5 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : title ? (
        <>
          {Icon && <Icon size={20} color={fg} />}
          <Text style={[styles.text, { color: fg }]}>{title}</Text>
          {IconRight && <IconRight size={20} color={fg} />}
        </>
      ) : (
        children
      )}
    </Pressable>
  );
}

const FG: Record<Variant, string> = {
  primary: colors.primaryForeground,
  outline: colors.foreground,
  ghost: colors.foreground,
  danger: '#FFFFFF',
};

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  text: { fontSize: 16, fontWeight: '500' },
  disabled: { backgroundColor: colors.muted, shadowOpacity: 0, elevation: 0 },
});

const VARIANTS = StyleSheet.create({
  primary: { backgroundColor: colors.primary, ...shadow.sm },
  outline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.destructive, ...shadow.sm },
});

const PRESSED = StyleSheet.create({
  primary: { backgroundColor: colors.primaryPressed },
  outline: { backgroundColor: colors.accent },
  ghost: { backgroundColor: colors.accent },
  danger: { opacity: 0.9 },
});
