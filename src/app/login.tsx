import { useCallback, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { ArrowLeft, ArrowRight, Settings } from 'lucide-react-native';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/Button';
import { Numpad } from '@/components/Numpad';
import { useAuth } from '@/features/auth/auth-context';
import { errorMessage } from '@/lib/api';
import { colors, radius, shadow } from '@/lib/theme';

type Step = 'cedula' | 'pin';
const MIN_CEDULA = 5;
const MAX_CEDULA = 15;
const MIN_PIN = 4;
const MAX_PIN = 12;

function vibrateError() {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export default function LoginScreen() {
  const { login, checkCedula } = useAuth();
  const [step, setStep] = useState<Step>('cedula');
  const [cedula, setCedula] = useState('');
  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hiddenInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Al volver (p. ej. desde "Servidor") recupera el foco del lector.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => hiddenInput.current?.focus(), 150);
      return () => clearTimeout(t);
    }, []),
  );

  const value = step === 'cedula' ? cedula : pin;
  const max = step === 'cedula' ? MAX_CEDULA : MAX_PIN;
  const canSubmit = step === 'cedula' ? cedula.length >= MIN_CEDULA : pin.length >= MIN_PIN;

  function setValue(next: string) {
    setError(null);
    const clean = next.replace(/\D/g, '').slice(0, max);
    if (step === 'cedula') setCedula(clean);
    else setPin(clean);
  }

  async function handleContinue(doc = cedula) {
    if (doc.length < MIN_CEDULA || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { exists, fullName } = await checkCedula(doc);
      if (!exists) {
        vibrateError();
        setError('Esta cédula no está registrada en el sistema.');
        return;
      }
      setUserName(fullName);
      setStep('pin');
    } catch (err) {
      vibrateError();
      setError(errorMessage(err, 'No se pudo validar la cédula. Intentá de nuevo.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (pin.length < MIN_PIN || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(cedula, pin);
    } catch (err) {
      vibrateError();
      setError(errorMessage(err, 'No se pudo iniciar sesión.'));
      setPin('');
      setBusy(false);
    }
  }

  function changeCedula() {
    setStep('cedula');
    setPin('');
    setUserName(null);
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Recibe lo que envíe el lector de código de barras (DataWedge en modo teclado) o un teclado físico. */}
      <TextInput
        ref={hiddenInput}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => (step === 'cedula' ? handleContinue() : handleSubmit())}
        submitBehavior="submit"
        showSoftInputOnFocus={false}
        caretHidden
        autoFocus
        keyboardType="number-pad"
        style={styles.hiddenInput}
        importantForAutofill="no"
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Configurar servidor"
            hitSlop={12}
            onPress={() => router.push('/servidor')}
            style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: colors.accent }]}
          >
            <Settings size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.brand}>
          <Brand subtitle="Terminal móvil" />
        </View>

        <View style={styles.card}>
          {step === 'pin' && (
            <View style={styles.pinHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hello} numberOfLines={1}>
                  {userName ? `Hola, ${userName.split(' ')[0]}` : `Cédula ${cedula}`}
                </Text>
                <Text style={styles.hint}>Ingresá tu PIN</Text>
              </View>
              <Pressable
                onPress={changeCedula}
                disabled={busy}
                hitSlop={8}
                style={({ pressed }) => [styles.changeBtn, pressed && { backgroundColor: colors.accent }]}
              >
                <ArrowLeft size={16} color={colors.foreground} />
                <Text style={styles.changeText}>Cambiar cédula</Text>
              </Pressable>
            </View>
          )}

          {step === 'cedula' ? <CedulaDisplay value={cedula} /> : <PinDisplay length={pin.length} />}

          <Numpad
            disabled={busy}
            onDigit={(d) => value.length < max && setValue(value + d)}
            onBackspace={() => setValue(value.slice(0, -1))}
            onClear={() => setValue('')}
          />

          <Button
            title={step === 'cedula' ? 'Continuar' : 'Ingresar'}
            iconRight={step === 'cedula' ? ArrowRight : undefined}
            loading={busy}
            disabled={!canSubmit}
            onPress={() => (step === 'cedula' ? handleContinue() : handleSubmit())}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Agropecuaria Santa Cruz, {new Date().getFullYear()}</Text>
          <Text style={styles.footerText}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </ScrollView>

      {/* Aviso flotante: no empuja el teclado numérico. */}
      {error && (
        <Pressable style={styles.error} accessibilityRole="alert" onPress={() => setError(null)}>
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function CedulaDisplay({ value }: { value: string }) {
  return (
    <View style={styles.display}>
      {value ? (
        <Text style={styles.displayText} adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Text style={styles.placeholder}>Número de cédula</Text>
      )}
    </View>
  );
}

function PinDisplay({ length }: { length: number }) {
  const dots = Math.max(length, MIN_PIN);
  return (
    <View style={styles.dots}>
      {Array.from({ length: dots }).map((_, i) => (
        <View key={i} style={[styles.dot, i < length && styles.dotFilled]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.loginBackground },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 12, justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -16 },
  iconBtn: { padding: 8, borderRadius: radius.lg },
  brand: { alignItems: 'center', marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    ...shadow.xl,
  },
  pinHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hello: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  hint: { fontSize: 14, color: colors.mutedForeground },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: radius.md,
  },
  changeText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  display: {
    height: 64,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  displayText: { fontSize: 30, fontWeight: '600', letterSpacing: 6, color: colors.foreground, fontVariant: ['tabular-nums'] },
  placeholder: { fontSize: 22, color: 'rgba(108,114,123,0.5)' },
  dots: { height: 40, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  error: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.red200,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  errorText: { color: colors.red700, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  footer: { marginTop: 12, alignItems: 'center', gap: 2 },
  footerText: { fontSize: 12, color: colors.mutedForeground },
});
