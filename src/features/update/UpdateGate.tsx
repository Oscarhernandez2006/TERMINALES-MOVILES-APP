import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, TriangleAlert } from 'lucide-react-native';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/Button';
import { colors, radius, shadow } from '@/lib/theme';
import {
  actualizacionHabilitada,
  buscarActualizacion,
  instalarActualizacion,
  versionInstalada,
  type VersionPublicada,
} from './update';

const CADA_MS = 30 * 60 * 1000;

/**
 * Revisa al abrir, al volver a primer plano y cada 30 min si hay una APK más nueva.
 * Si la hay, bloquea la app hasta instalarla. Sin internet deja trabajar normal.
 */
export function UpdateGate({ children }: { children: React.ReactNode }) {
  const [pendiente, setPendiente] = useState<VersionPublicada | null>(null);
  const revisando = useRef(false);

  const revisar = useCallback(async () => {
    if (!actualizacionHabilitada() || revisando.current) return;
    revisando.current = true;
    try {
      setPendiente(await buscarActualizacion());
    } catch {
      // Sin conexión a GitHub: se reintenta en la próxima revisión.
    } finally {
      revisando.current = false;
    }
  }, []);

  useEffect(() => {
    void revisar();
    const id = setInterval(() => void revisar(), CADA_MS);
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revisar();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [revisar]);

  if (!pendiente) return <>{children}</>;
  return <PantallaActualizar version={pendiente} />;
}

function PantallaActualizar({ version }: { version: VersionPublicada }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actual = versionInstalada().version;

  async function actualizar() {
    setError(null);
    setDescargando(true);
    try {
      await instalarActualizacion(version);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar la actualización');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brand}>
        <Brand subtitle="Terminales" />
      </View>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Download size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>Actualización disponible</Text>
        <Text style={styles.text}>
          Hay una versión nueva de la app. Debes instalarla para seguir trabajando.
        </Text>
        <View style={styles.versiones}>
          <Text style={styles.versionLabel}>Instalada</Text>
          <Text style={styles.versionValue}>v{actual}</Text>
          <Text style={styles.versionLabel}>Nueva</Text>
          <Text style={[styles.versionValue, { color: colors.primary }]}>v{version.version}</Text>
        </View>
        {error && (
          <View style={styles.error}>
            <TriangleAlert size={18} color={colors.red700} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Button
          title={descargando ? 'Descargando…' : 'Actualizar ahora'}
          icon={Download}
          loading={descargando}
          onPress={actualizar}
          style={{ alignSelf: 'stretch' }}
        />
        <Text style={styles.hint}>Cuando Android lo pida, toca «Instalar».</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.loginBackground, padding: 20, justifyContent: 'center', gap: 24 },
  brand: { alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 14,
    alignItems: 'center',
    ...shadow.xl,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  text: { fontSize: 15, color: colors.mutedForeground, textAlign: 'center' },
  versiones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
    columnGap: 6,
    rowGap: 4,
  },
  versionLabel: { fontSize: 13, color: colors.mutedForeground },
  versionValue: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginRight: 10 },
  error: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    alignSelf: 'stretch',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.red200,
    backgroundColor: '#FEF2F2',
  },
  errorText: { flex: 1, color: colors.red700, fontSize: 14 },
  hint: { fontSize: 13, color: colors.mutedForeground },
});
