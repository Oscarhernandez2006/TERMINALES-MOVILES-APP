import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  ClipboardList,
  LockKeyhole,
  PackagePlus,
  TriangleAlert,
  UserRound,
} from 'lucide-react-native';
import { Button } from '@/components/Button';
import { useAuth } from '@/features/auth/auth-context';
import {
  esTipoPicking,
  kg,
  useAsignacion,
  useCrearPreordenGeneral,
  usePicking,
  type LineaAvance,
  type PreordenResumen,
  type TipoPicking,
} from '@/features/picking/api';
import { errorMessage } from '@/lib/api';
import { colors, radius, shadow } from '@/lib/theme';

export default function PickingOrdenScreen() {
  const p = useLocalSearchParams<{ tipo: string; id: string; numero?: string; cliente?: string; nit?: string }>();
  if (!esTipoPicking(p.tipo) || !p.id) return <Redirect href="/picking" />;
  return <OrdenMadre tipo={p.tipo} ordenId={p.id} numero={p.numero ?? ''} cliente={p.cliente ?? ''} nit={p.nit ?? ''} />;
}

/**
 * Orden madre (la de escritorio): sus pre-órdenes por tienda, cada una con su parte de la orden
 * de compra. El alistador se asigna una pre-orden para alistarla; otro no la puede tomar hasta
 * que se libere.
 */
function OrdenMadre({ tipo, ordenId, numero, cliente, nit }: { tipo: TipoPicking; ordenId: string; numero: string; cliente: string; nit: string }) {
  const { user } = useAuth();
  const picking = usePicking(tipo, ordenId);
  const crear = useCrearPreordenGeneral(tipo, ordenId);
  const asignacion = useAsignacion();
  const [vista, setVista] = useState<'preordenes' | 'oc'>('preordenes');
  const [abierta, setAbierta] = useState<string | null>(null);
  const d = picking.data;
  const activa = d?.ordenActiva ?? true;
  const preordenes = d?.preordenes ?? [];
  const conOc = preordenes.filter((p) => p.lineasTotal > 0);
  const sinOc = preordenes.find((p) => !p.ocNumero && !p.lineasTotal);
  const ocupado = asignacion.isPending || crear.isPending;

  function abrir(id: string) {
    router.push({ pathname: '/picking/preorden/[id]', params: { id, cliente } });
  }

  function asignarYAbrir(id: string) {
    asignacion.mutate(
      { id, accion: 'asignar' },
      {
        onSuccess: () => abrir(id),
        onError: (err) => Alert.alert('No se pudo asignar', errorMessage(err, 'Intenta de nuevo.')),
      },
    );
  }

  function seleccionar(p: PreordenResumen) {
    if (p.asignado?.id === user?.id) return abrir(p.id);
    if (p.asignado) {
      return Alert.alert('Pre-orden ocupada', `${p.nombre} está asignada a ${p.asignado.nombre}. Debe liberarla para que otro la aliste.`);
    }
    if (!activa) return Alert.alert('Orden cerrada', 'La orden ya no está activa.');
    Alert.alert('Asignarme pre-orden', `¿Asignarme la pre-orden ${p.nombre}?\n\nMientras la tengas, nadie más la podrá alistar.`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, asignarme', onPress: () => asignarYAbrir(p.id) },
    ]);
  }

  function alistarSinOc() {
    if (sinOc) return seleccionar(sinOc);
    Alert.alert('Alistar sin orden de compra', '¿Crear y asignarme una pre-orden sin orden de compra?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, asignarme',
        onPress: () =>
          crear.mutate(undefined, {
            onSuccess: (p) => asignarYAbrir(p.id),
            onError: (err) => Alert.alert('No se pudo crear', errorMessage(err, 'Intenta de nuevo.')),
          }),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.orden}>
        <View style={styles.numero}>
          <Text style={styles.numeroText}>{numero}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cliente} numberOfLines={1}>
            {cliente}
          </Text>
          <Text style={styles.meta}>{nit ? `NIT ${nit}` : 'Sin NIT'}</Text>
        </View>
        {d?.porcentaje != null && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.pctOrden, d.porcentaje >= 100 && { color: colors.success }]}>{d.porcentaje.toLocaleString('es-CO')}%</Text>
            <Text style={styles.meta}>de la orden</Text>
          </View>
        )}
      </View>

      {!activa && (
        <View style={styles.aviso}>
          <LockKeyhole size={20} color={colors.mutedForeground} />
          <Text style={[styles.meta, { flex: 1 }]}>La orden ya no está activa.</Text>
        </View>
      )}

      <View style={styles.tabs}>
        {(['preordenes', 'oc'] as const).map((v) => (
          <Pressable key={v} onPress={() => setVista(v)} style={[styles.tab, vista === v && styles.tabActivo]}>
            <Text style={[styles.tabText, vista === v && styles.tabTextActivo]}>
              {v === 'preordenes' ? `Pre-órdenes (${preordenes.length})` : `Orden de compra (${conOc.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        refreshControl={<RefreshControl refreshing={picking.isRefetching} onRefresh={() => void picking.refetch()} />}
      >
        {(vista === 'preordenes' ? !preordenes.length : !conOc.length) ? (
          <View style={styles.vacio}>
            <ClipboardList size={36} color={colors.mutedForeground} />
            <Text style={styles.vacioText}>
              {picking.isLoading
                ? 'Cargando…'
                : picking.isError
                  ? errorMessage(picking.error, 'No se pudo cargar el picking.')
                  : 'Esta orden no tiene órdenes de compra cargadas. Se cargan en escritorio (Importar Excel de OC) o puedes alistar sin OC.'}
            </Text>
          </View>
        ) : vista === 'preordenes' ? (
          preordenes.map((p) => (
            <Tarjeta
              key={p.id}
              p={p}
              miId={user?.id}
              abierta={abierta === p.id}
              onVer={() => setAbierta((a) => (a === p.id ? null : p.id))}
              onPress={() => seleccionar(p)}
            />
          ))
        ) : (
          conOc.map((p) => (
            <View key={p.id} style={styles.seccionOc}>
              <EncabezadoTienda p={p} />
              <LineasOc lineas={p.avance} />
            </View>
          ))
        )}
      </ScrollView>

      {activa && vista === 'preordenes' && (
        <Button title="Alistar sin orden de compra" variant="outline" onPress={alistarSinOc} disabled={ocupado || picking.isLoading} icon={PackagePlus} />
      )}
    </View>
  );
}

function Tarjeta({
  p,
  miId,
  abierta,
  onVer,
  onPress,
}: {
  p: PreordenResumen;
  miId: string | undefined;
  abierta: boolean;
  onVer: () => void;
  onPress: () => void;
}) {
  const pct = p.porcentaje;
  const completa = pct != null && pct >= 100;
  const terminada = p.status === 'terminado';
  const color = completa ? colors.success : colors.primary;
  const mia = !!p.asignado && p.asignado.id === miId;
  const ajena = !!p.asignado && !mia;
  return (
    <View style={[styles.tarjeta, completa && styles.tarjetaCompleta, ajena && { opacity: 0.75 }]}>
      <Pressable onPress={onPress} style={({ pressed }) => [{ gap: 8 }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Pre-orden ${p.nombre}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {completa ? <CircleCheck size={20} color={colors.success} /> : ajena ? <LockKeyhole size={18} color={colors.mutedForeground} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.nombre} numberOfLines={1}>
              {p.tiendaNombre ?? p.nombre}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[p.tiendaCodigo ? `Tienda ${p.tiendaCodigo}` : null, p.ocNumero ? `OC ${p.ocNumero}` : 'Sin orden de compra'].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {pct != null && <Text style={[styles.pct, { color }]}>{pct.toLocaleString('es-CO')}%</Text>}
          <ChevronRight size={20} color={colors.mutedForeground} />
        </View>
        {pct != null && (
          <View style={styles.barra}>
            <View style={[styles.barraLlena, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
          </View>
        )}
        <Text style={styles.meta}>
          {p.lineasTotal ? `${p.lineasCompletas}/${p.lineasTotal} productos · ${kg(p.kgPedidos)} kg pedidos · ` : ''}
          {p.empaques} emp. · {kg(p.kgAlistados)} kg alistados
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip
            texto={mia ? 'Asignada a ti' : ajena ? p.asignado!.nombre : 'Libre'}
            tono={mia ? 'primario' : ajena ? 'gris' : 'neutro'}
            icono={p.asignado ? <UserRound size={12} color={mia ? colors.primary : colors.mutedForeground} /> : null}
          />
          <Chip texto={terminada ? 'Terminada' : 'En curso'} tono={terminada ? 'verde' : 'ambar'} />
          {p.porPesar > 0 && terminada && <Chip texto={`${p.porPesar} por pesar`} tono="ambar" />}
        </View>
      </Pressable>
      {p.lineasTotal > 0 && (
        <>
          <Pressable onPress={onVer} style={styles.verPedido} accessibilityRole="button">
            {abierta ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
            <Text style={styles.verPedidoText}>{abierta ? 'Ocultar pedido' : 'Ver pedido de la tienda'}</Text>
          </Pressable>
          {abierta && <LineasOc lineas={p.avance} />}
        </>
      )}
    </View>
  );
}

function Chip({ texto, tono, icono }: { texto: string; tono: 'primario' | 'gris' | 'neutro' | 'verde' | 'ambar'; icono?: React.ReactNode }) {
  const t = {
    primario: { borderColor: colors.primary, backgroundColor: colors.primarySoft, color: colors.primary },
    gris: { borderColor: colors.border, backgroundColor: colors.muted, color: colors.mutedForeground },
    neutro: { borderColor: colors.border, backgroundColor: colors.card, color: colors.mutedForeground },
    verde: { borderColor: colors.green200, backgroundColor: colors.green50, color: '#15803D' },
    ambar: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: colors.amber },
  }[tono];
  return (
    <View style={[styles.chip, { borderColor: t.borderColor, backgroundColor: t.backgroundColor }]}>
      {icono}
      <Text style={[styles.chipText, { color: t.color }]} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

function EncabezadoTienda({ p }: { p: PreordenResumen }) {
  const pct = p.porcentaje ?? 0;
  const completa = pct >= 100;
  return (
    <View style={[styles.encTienda, completa && { backgroundColor: '#DCFCE7' }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.nombre} numberOfLines={1}>
          {p.tiendaNombre ?? p.nombre}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[p.tiendaCodigo ? `Tienda ${p.tiendaCodigo}` : null, p.ocNumero ? `OC ${p.ocNumero}` : null, `${kg(p.kgPedidos)} kg`, p.asignado?.nombre]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Text style={[styles.pct, { color: completa ? colors.success : colors.primary }]}>{pct.toLocaleString('es-CO')}%</Text>
    </View>
  );
}

/** Pedido de la tienda: kilos pedidos contra alistados; la fila se pone verde al completarse. */
function LineasOc({ lineas }: { lineas: LineaAvance[] }) {
  const filas = lineas.filter((l) => l.kgPedidos !== null || l.empaques > 0);
  return (
    <View style={styles.lineas}>
      {filas.map((l) => {
        const fuera = l.kgPedidos === null;
        const excedido = !fuera && l.kgAlistados > (l.kgPedidos ?? 0);
        const fondo = fuera || excedido ? '#FFFBEB' : l.completo ? '#DCFCE7' : undefined;
        return (
          <View key={l.productoId} style={[styles.linea, fondo ? { backgroundColor: fondo } : null]}>
            {l.completo && !excedido ? (
              <CircleCheck size={16} color={colors.success} />
            ) : fuera || excedido ? (
              <TriangleAlert size={16} color={colors.amber} />
            ) : (
              <View style={{ width: 16 }} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.lineaProducto} numberOfLines={1}>
                {l.productoNombre}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[l.plu ? `PLU ${l.plu}` : l.productoCodigo, fuera ? 'No está en la OC' : null, l.empaques ? `${l.empaques} emp.` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Text style={[styles.lineaKg, l.completo && !excedido && { color: '#15803D' }]}>
              {kg(l.kgAlistados)}
              {!fuera && <Text style={styles.lineaDe}> / {kg(l.kgPedidos ?? 0)}</Text>}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 10 },
  orden: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numero: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 6 },
  numeroText: { fontSize: 18, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },
  cliente: { fontSize: 15, fontWeight: '700', color: colors.foreground, textTransform: 'uppercase' },
  meta: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  pctOrden: { fontSize: 24, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  tabs: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.lg, padding: 3, gap: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: radius.md },
  tabActivo: { backgroundColor: colors.card, ...shadow.sm },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  tabTextActivo: { color: colors.primary },
  tarjeta: {
    gap: 8,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  tarjetaCompleta: { borderColor: colors.green200, backgroundColor: '#F0FDF4' },
  nombre: { fontSize: 15, fontWeight: '700', color: colors.foreground, textTransform: 'uppercase' },
  pct: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  barra: { height: 8, borderRadius: 4, backgroundColor: colors.muted, overflow: 'hidden' },
  barraLlena: { height: 8, borderRadius: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md, borderWidth: 1, maxWidth: '100%' },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  verPedido: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  verPedidoText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  seccionOc: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden', ...shadow.sm },
  encTienda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineas: { borderRadius: radius.lg, overflow: 'hidden' },
  linea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineaProducto: { fontSize: 13, fontWeight: '600', color: colors.foreground, textTransform: 'uppercase' },
  lineaKg: { fontSize: 14, fontWeight: '700', color: colors.foreground, fontVariant: ['tabular-nums'] },
  lineaDe: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground },
  vacio: { alignItems: 'center', gap: 10, padding: 24 },
  vacioText: { textAlign: 'center', fontSize: 14, color: colors.mutedForeground },
});