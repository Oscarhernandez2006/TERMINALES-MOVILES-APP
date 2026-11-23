import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  CircleCheck,
  Keyboard,
  LoaderCircle,
  LockKeyhole,
  ScanBarcode,
  Scale,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { Button } from '@/components/Button';
import {
  agruparPorProducto,
  esTipoPicking,
  kg,
  useAgregarPicking,
  useEstadoPicking,
  usePicking,
  useQuitarPicking,
  type ItemPicking,
  type TipoPicking,
} from '@/features/picking/api';
import { errorMessage } from '@/lib/api';
import { colors, radius, shadow } from '@/lib/theme';

type Lectura =
  | { estado: 'procesando'; codigo: string }
  | { estado: 'ok'; codigo: string; producto: string; detalle: string; advertencia: string | null }
  | { estado: 'error'; codigo: string; mensaje: string };

function vibrar(tipo: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(tipo);
}

export default function PickingOrdenScreen() {
  const p = useLocalSearchParams<{ tipo: string; id: string; numero?: string; cliente?: string; nit?: string }>();
  if (!esTipoPicking(p.tipo) || !p.id) return <Redirect href="/picking" />;
  return <Picking tipo={p.tipo} ordenId={p.id} numero={p.numero ?? ''} cliente={p.cliente ?? ''} nit={p.nit ?? ''} />;
}

function Picking({ tipo, ordenId, numero, cliente, nit }: { tipo: TipoPicking; ordenId: string; numero: string; cliente: string; nit: string }) {
  const picking = usePicking(tipo, ordenId);
  const agregar = useAgregarPicking(tipo, ordenId);
  const quitar = useQuitarPicking(tipo, ordenId);
  const estado = useEstadoPicking(tipo, ordenId);

  const scanner = useRef<React.ComponentRef<typeof TextInput>>(null);
  const cola = useRef(Promise.resolve());
  const [escaneo, setEscaneo] = useState('');
  const [manual, setManual] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [vista, setVista] = useState<'producto' | 'etiquetas'>('producto');
  // Mientras se digita o hay un diálogo abierto no se le roba el foco al usuario.
  const manualRef = useRef(false);
  manualRef.current = manual;
  const dialogoRef = useRef(false);
  const pausado = useCallback(() => manualRef.current || dialogoRef.current, []);
  const enPantallaRef = useRef(false);

  const terminado = picking.data?.status === 'terminado';
  const terminadoRef = useRef(terminado);
  terminadoRef.current = terminado;
  const ordenActiva = picking.data?.ordenActiva ?? true;

  const lista = useMemo(() => picking.data?.items ?? [], [picking.data]);
  const totales = useMemo(
    () => ({
      empaques: lista.length,
      pesados: lista.filter((i) => i.pesado).length,
      unds: lista.reduce((s, i) => s + i.unds, 0),
      kg: lista.reduce((s, i) => s + i.netoEtiquetaKg, 0),
    }),
    [lista],
  );
  const porProducto = useMemo(() => agruparPorProducto(lista), [lista]);

  const enfocarScanner = useCallback(() => {
    setTimeout(() => {
      if (enPantallaRef.current && !pausado()) scanner.current?.focus();
    }, 150);
  }, [pausado]);

  // El lector (DataWedge en modo teclado) escribe en el campo enfocado: se mantiene el foco
  // en el campo oculto para que el primer disparo entre sin tocar la pantalla.
  useFocusEffect(
    useCallback(() => {
      enPantallaRef.current = true;
      enfocarScanner();
      const id = setInterval(() => {
        if (!pausado() && !scanner.current?.isFocused()) scanner.current?.focus();
      }, 800);
      return () => {
        enPantallaRef.current = false;
        clearInterval(id);
      };
    }, [enfocarScanner, pausado]),
  );

  useEffect(() => {
    if (!manual) enfocarScanner();
  }, [manual, enfocarScanner]);

  function alerta(titulo: string, mensaje: string, botones: Parameters<typeof Alert.alert>[2]) {
    dialogoRef.current = true;
    const liberar = () => {
      dialogoRef.current = false;
      enfocarScanner();
    };
    Alert.alert(
      titulo,
      mensaje,
      botones?.map((b) => ({ ...b, onPress: (v?: string) => (b.onPress?.(v), liberar()) })),
      { cancelable: true, onDismiss: liberar },
    );
  }

  async function procesar(codigo: string) {
    setLectura({ estado: 'procesando', codigo });
    try {
      if (terminadoRef.current) {
        throw new Error('El picking está terminado. Reábrelo para seguir alistando.');
      }
      if (tipo === 'traslado' && !/^[1-9]\d{7}$/.test(codigo)) {
        throw new Error('El código debe ser el de una etiqueta de pieza o canastilla (8 dígitos).');
      }
      const item = await agregar.mutateAsync(codigo);
      const detalle = [item.tipo === 'canastilla' ? 'Canastilla' : 'Pieza', `${item.unds} und`, `${kg(item.netoEtiquetaKg)} kg`].join(' · ');
      setLectura({ estado: 'ok', codigo: item.codigo, producto: item.productoNombre, detalle, advertencia: item.advertenciaInventario });
      vibrar(item.advertenciaInventario ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const mensaje = err instanceof Error && !('isAxiosError' in err) ? err.message : errorMessage(err, 'No se pudo alistar la etiqueta.');
      setLectura({ estado: 'error', codigo, mensaje });
      vibrar(Haptics.NotificationFeedbackType.Error);
    }
  }

  // Las lecturas se procesan en orden aunque el operario pistolee rápido.
  function encolar(raw: string) {
    const codigo = raw.trim().toUpperCase();
    if (!codigo) return;
    cola.current = cola.current.then(() => procesar(codigo));
  }

  function onScan() {
    encolar(escaneo);
    setEscaneo('');
    scanner.current?.focus();
  }

  function agregarManual() {
    encolar(codigoManual);
    setCodigoManual('');
    setManual(false);
  }

  function confirmarQuitar(item: ItemPicking) {
    alerta('Quitar etiqueta', `¿Quitar ${item.codigo} (${item.productoNombre}, ${kg(item.netoEtiquetaKg)} kg) del picking?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () =>
          quitar.mutate(item.id, {
            onError: (err) => Alert.alert('No se pudo quitar', errorMessage(err, 'Intenta de nuevo.')),
          }),
      },
    ]);
  }

  function cambiarEstado(accion: 'terminar' | 'reabrir') {
    const terminar = accion === 'terminar';
    alerta(
      terminar ? 'Terminar picking' : 'Reabrir picking',
      terminar
        ? `${totales.empaques} etiquetas · ${kg(totales.kg)} kg.\nQueda listo para pesar los arrumes en escritorio.`
        : 'Se podrán volver a agregar o quitar etiquetas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: terminar ? 'Terminar' : 'Reabrir',
          onPress: () =>
            estado.mutate(accion, {
              onSuccess: () => {
                setLectura(null);
                vibrar(Haptics.NotificationFeedbackType.Success);
              },
              onError: (err) => Alert.alert('No se pudo actualizar', errorMessage(err, 'Intenta de nuevo.')),
            }),
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      {/* Recibe lo que envía el lector (DataWedge en modo teclado, con Enter al final). */}
      <TextInput
        ref={scanner}
        value={escaneo}
        onChangeText={setEscaneo}
        onSubmitEditing={onScan}
        onBlur={() => {
          if (!pausado()) enfocarScanner();
        }}
        autoFocus
        submitBehavior="submit"
        showSoftInputOnFocus={false}
        caretHidden
        autoCapitalize="characters"
        style={styles.hidden}
        importantForAutofill="no"
      />

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
        {picking.data && (
          <View style={[styles.estado, terminado ? styles.estadoTerminado : styles.estadoCurso]}>
            <Text style={[styles.estadoText, { color: terminado ? '#15803D' : colors.amber }]}>
              {terminado ? 'Terminado' : 'En curso'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.totales}>
        <Total label="Empaques" valor={String(totales.empaques)} />
        <Total label="Unds" valor={String(totales.unds)} />
        <Total label="Kg etiqueta" valor={kg(totales.kg)} color={colors.success} />
        <Total label="Pesados" valor={`${totales.pesados}/${totales.empaques}`} />
      </View>

      {!ordenActiva ? (
        <Aviso icono={<LockKeyhole size={22} color={colors.mutedForeground} />} titulo="Orden cerrada" texto="La orden ya no está activa." />
      ) : terminado ? (
        <View style={[styles.scan, styles.scanTerminado]}>
          <Scale size={24} color="#15803D" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.scanTitle, { color: '#15803D' }]}>Listo para pesar</Text>
            <Text style={styles.scanSub}>Los arrumes se pesan en escritorio</Text>
          </View>
          <Button
            title="Reabrir"
            variant="outline"
            onPress={() => cambiarEstado('reabrir')}
            disabled={estado.isPending}
            style={{ height: 40, paddingHorizontal: 12 }}
          />
        </View>
      ) : manual ? (
        <View style={styles.manual}>
          <TextInput
            value={codigoManual}
            onChangeText={setCodigoManual}
            onSubmitEditing={agregarManual}
            placeholder="Código de la etiqueta"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            autoCapitalize="characters"
            keyboardType={tipo === 'traslado' ? 'number-pad' : 'default'}
            style={styles.manualInput}
          />
          <Button title="Agregar" onPress={agregarManual} disabled={!codigoManual.trim()} style={{ height: 46, paddingHorizontal: 14 }} />
          <Pressable onPress={() => setManual(false)} style={styles.iconBtn} accessibilityLabel="Cerrar digitación">
            <X size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.scan}>
          <ScanBarcode size={26} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>Pistolea las etiquetas</Text>
            <Text style={styles.scanSub}>Pre-orden: se pesan luego en arrume</Text>
          </View>
          <Pressable onPress={() => setManual(true)} style={styles.iconBtn} accessibilityLabel="Digitar código">
            <Keyboard size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

      {lectura && <Resultado lectura={lectura} />}

      <View style={styles.tabs}>
        {(['producto', 'etiquetas'] as const).map((v) => (
          <Pressable key={v} onPress={() => setVista(v)} style={[styles.tab, vista === v && styles.tabActivo]}>
            <Text style={[styles.tabText, vista === v && styles.tabTextActivo]}>
              {v === 'producto' ? `Por producto (${porProducto.length})` : `Etiquetas (${lista.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.listaBox} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {!lista.length ? (
          <Text style={styles.vacio}>
            {picking.isLoading ? 'Cargando…' : picking.isError ? errorMessage(picking.error, 'No se pudo cargar el picking.') : 'Aún no hay etiquetas alistadas.'}
          </Text>
        ) : vista === 'producto' ? (
          porProducto.map((g) => (
            <View key={g.codigo} style={styles.fila}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{g.empaques}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.producto} numberOfLines={1}>
                  {g.producto}
                </Text>
                <Text style={styles.meta}>
                  {g.codigo} · {g.unds} und{g.pesados ? ` · ${g.pesados} pesados` : ''}
                </Text>
              </View>
              <Text style={styles.kg}>{kg(g.kg)}</Text>
            </View>
          ))
        ) : (
          lista.map((i) => (
            <View key={i.id} style={styles.fila}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.producto} numberOfLines={1}>
                  {i.productoNombre}
                </Text>
                <Text style={styles.meta}>
                  {i.codigo} · {i.tipo === 'canastilla' ? 'Canastilla' : 'Pieza'} · {i.unds} und
                </Text>
              </View>
              <Text style={styles.kg}>{kg(i.netoEtiquetaKg)}</Text>
              {i.pesado ? (
                <View style={styles.pesado}>
                  <Text style={styles.pesadoText}>Pesado</Text>
                </View>
              ) : (
                !terminado &&
                ordenActiva && (
                  <Pressable onPress={() => confirmarQuitar(i)} style={styles.iconBtn} accessibilityLabel={`Quitar ${i.codigo}`}>
                    <Trash2 size={18} color={colors.destructive} />
                  </Pressable>
                )
              )}
            </View>
          ))
        )}
      </ScrollView>

      {ordenActiva && !terminado && lista.length > 0 && (
        <Button title="Terminar picking" onPress={() => cambiarEstado('terminar')} disabled={estado.isPending} />
      )}
    </View>
  );
}

function Total({ label, valor, color }: { label: string; valor: string; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.totalLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.totalValor, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
    </View>
  );
}

function Aviso({ icono, titulo, texto }: { icono: React.ReactNode; titulo: string; texto: string }) {
  return (
    <View style={[styles.scan, { borderStyle: 'solid', borderColor: colors.border, backgroundColor: colors.muted }]}>
      {icono}
      <View style={{ flex: 1, paddingVertical: 6 }}>
        <Text style={[styles.scanTitle, { color: colors.foreground }]}>{titulo}</Text>
        <Text style={styles.scanSub}>{texto}</Text>
      </View>
    </View>
  );
}

function Resultado({ lectura }: { lectura: Lectura }) {
  if (lectura.estado === 'procesando') {
    return (
      <View style={[styles.resultado, { borderColor: colors.border }]}>
        <LoaderCircle size={20} color={colors.mutedForeground} />
        <Text style={styles.resultadoText}>Validando {lectura.codigo}…</Text>
      </View>
    );
  }
  if (lectura.estado === 'error') {
    return (
      <View style={[styles.resultado, { borderColor: colors.red200, backgroundColor: '#FEF2F2' }]}>
        <TriangleAlert size={20} color={colors.red700} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.resultadoTitle, { color: colors.red700 }]}>{lectura.codigo}</Text>
          <Text style={[styles.resultadoText, { color: colors.red700 }]}>{lectura.mensaje}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.resultado, { borderColor: colors.green200, backgroundColor: colors.green50 }]}>
        <CircleCheck size={20} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.resultadoTitle, { color: '#15803D' }]} numberOfLines={1}>
            {lectura.producto}
          </Text>
          <Text style={[styles.resultadoText, { color: '#15803D' }]}>
            {lectura.codigo} · {lectura.detalle}
          </Text>
        </View>
      </View>
      {lectura.advertencia && (
        <View style={[styles.resultado, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
          <TriangleAlert size={20} color={colors.amber} />
          <Text style={[styles.resultadoText, { flex: 1, color: '#92400E' }]}>{lectura.advertencia}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 10 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
  orden: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numero: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 6 },
  numeroText: { fontSize: 18, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },
  cliente: { fontSize: 15, fontWeight: '700', color: colors.foreground, textTransform: 'uppercase' },
  meta: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  estado: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md, borderWidth: 1 },
  estadoCurso: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  estadoTerminado: { borderColor: colors.green200, backgroundColor: colors.green50 },
  estadoText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  totales: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  totalLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, textTransform: 'uppercase' },
  totalValor: { fontSize: 17, fontWeight: '700', color: colors.foreground, fontVariant: ['tabular-nums'] },
  scan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 8,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,107,91,0.5)',
    backgroundColor: colors.primaryTint,
  },
  scanTerminado: { borderStyle: 'solid', borderColor: colors.green200, backgroundColor: colors.green50, paddingRight: 8 },
  scanTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  scanSub: { fontSize: 12, color: colors.mutedForeground },
  manual: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  manualInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    color: colors.foreground,
  },
  iconBtn: { padding: 10, borderRadius: radius.lg },
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  resultadoTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  resultadoText: { fontSize: 13, color: colors.mutedForeground },
  tabs: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.lg, padding: 3, gap: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: radius.md },
  tabActivo: { backgroundColor: colors.card, ...shadow.sm },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  tabTextActivo: { color: colors.primary },
  listaBox: { flex: 1, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  vacio: { padding: 24, textAlign: 'center', fontSize: 14, color: colors.mutedForeground },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  badge: { minWidth: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  producto: { fontSize: 14, fontWeight: '600', color: colors.foreground, textTransform: 'uppercase' },
  kg: { fontSize: 15, fontWeight: '700', color: colors.foreground, fontVariant: ['tabular-nums'] },
  pesado: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.md, backgroundColor: colors.green50 },
  pesadoText: { fontSize: 10, fontWeight: '700', color: '#15803D', textTransform: 'uppercase' },
});
