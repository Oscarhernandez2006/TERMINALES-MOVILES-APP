import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CircleCheck, CircleX } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { DEFAULT_API_URL, errorMessage, getApiUrl, normalizeApiUrl, saveApiUrl, testApiUrl } from '@/lib/api';
import { colors, radius } from '@/lib/theme';

type Status = { ok: boolean; text: string } | null;

export default function ServidorScreen() {
  const [url, setUrl] = useState(getApiUrl());
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function probar() {
    setTesting(true);
    setStatus(null);
    try {
      await testApiUrl(url);
      setStatus({ ok: true, text: `Conectado a ${normalizeApiUrl(url)}` });
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err, 'El servidor no respondió.') });
    } finally {
      setTesting(false);
    }
  }

  async function guardar() {
    await saveApiUrl(url);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Dirección de la API</Text>
      <TextInput
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          setStatus(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={DEFAULT_API_URL}
        style={styles.input}
      />
      <Text style={styles.help}>Ejemplo: 192.168.1.249 o http://192.168.1.249/api</Text>

      {status && (
        <View style={[styles.status, status.ok ? styles.ok : styles.fail]}>
          {status.ok ? (
            <CircleCheck size={20} color={colors.success} />
          ) : (
            <CircleX size={20} color={colors.destructive} />
          )}
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      )}

      <Button title="Probar conexión" variant="outline" loading={testing} onPress={probar} />
      <Button title="Guardar" disabled={!url.trim()} onPress={guardar} />
      <Button title="Restablecer predeterminado" variant="ghost" onPress={() => setUrl(DEFAULT_API_URL)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.foreground,
  },
  help: { fontSize: 13, color: colors.mutedForeground, marginTop: -4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.xl, borderWidth: 1 },
  ok: { backgroundColor: colors.green50, borderColor: colors.green200 },
  fail: { backgroundColor: '#FFFFFF', borderColor: colors.red200 },
  statusText: { flex: 1, fontSize: 14, color: colors.foreground },
});
