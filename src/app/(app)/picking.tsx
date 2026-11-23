import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Inbox, Search, Store, Truck } from 'lucide-react-native';
import { TIPOS, formatFecha, useOrdenesPicking, type OrdenPicking, type TipoPicking } from '@/features/picking/api';
import { errorMessage } from '@/lib/api';
import { colors, radius, shadow } from '@/lib/theme';

const PESTANAS: { tipo: TipoPicking; icon: typeof Truck }[] = [
  { tipo: 'posta', icon: Store },
  { tipo: 'traslado', icon: Truck },
];

export default function PickingOrdenesScreen() {
  const [tipo, setTipo] = useState<TipoPicking>('posta');
  const [busqueda, setBusqueda] = useState('');
  const ordenes = useOrdenesPicking(tipo);

  const q = busqueda.trim().toUpperCase();
  const lista = (ordenes.data ?? []).filter(
    (o) => !q || [o.numero, o.cliente?.concepto, o.cliente?.nit ?? ''].join(' ').toUpperCase().includes(q),
  );

  function abrir(o: OrdenPicking) {
    router.push({
      pathname: '/picking/[tipo]/[id]',
      params: { tipo, id: o.id, numero: o.numero, cliente: o.cliente?.concepto ?? '', nit: o.cliente?.nit ?? '' },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.segmented}>
        {PESTANAS.map(({ tipo: t, icon: Icono }) => {
          const activo = t === tipo;
          return (
            <Pressable key={t} onPress={() => setTipo(t)} style={[styles.segment, activo && styles.segmentActivo]}>
              <Icono size={18} color={activo ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.segmentText, activo && styles.segmentTextActivo]}>{TIPOS[t].titulo}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar orden, cliente o NIT"
          placeholderTextColor={colors.mutedForeground}
          style={styles.searchInput}
          autoCapitalize="characters"
        />
      </View>

      <Text style={styles.contador}>
        <Text style={styles.contadorNum}>{lista.length}</Text> orden(es) activa(s)
      </Text>

      {ordenes.isLoading ? (
        <View style={styles.vacio}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.vacioText}>Cargando…</Text>
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 16, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={ordenes.isRefetching} onRefresh={() => void ordenes.refetch()} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={[styles.vacio, styles.vacioBorde]}>
              <Inbox size={32} color={colors.mutedForeground} />
              <Text style={styles.vacioText}>
                {ordenes.isError
                  ? errorMessage(ordenes.error, 'No se pudieron cargar las órdenes.')
                  : q
                    ? 'Ninguna orden coincide con la búsqueda.'
                    : tipo === 'posta'
                      ? 'No hay despachos posta activos. Créalos en escritorio.'
                      : 'No hay órdenes de traslado activas. Créalas en escritorio.'}
              </Text>
            </View>
          }
          renderItem={({ item: o }) => (
            <Pressable onPress={() => abrir(o)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.numero}>
                <Text style={styles.numeroText}>{o.numero}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cliente} numberOfLines={1}>
                  {o.cliente?.concepto}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {o.cliente?.nit ? `NIT ${o.cliente.nit} · ` : ''}Proceso {formatFecha(o.processDate)}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingTop: 12, gap: 10 },
  segmented: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.lg, padding: 4, gap: 4 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md },
  segmentActivo: { backgroundColor: colors.card, ...shadow.sm },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  segmentTextActivo: { color: colors.primary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.foreground, paddingVertical: 0 },
  contador: { fontSize: 13, color: colors.mutedForeground, paddingHorizontal: 2 },
  contadorNum: { fontWeight: '700', color: colors.foreground },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  cardPressed: { borderColor: 'rgba(0,107,91,0.5)', backgroundColor: colors.primaryTint },
  numero: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 6 },
  numeroText: { fontSize: 18, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },
  cliente: { fontSize: 15, fontWeight: '700', color: colors.foreground, textTransform: 'uppercase' },
  meta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  vacioBorde: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.xl },
  vacioText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
});
