import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { useAuth } from '@/features/auth/auth-context';
import {
  agruparPorProducto,
  kg,
  useAgregarPicking,
  useAsignacion,
  useEstadoPicking,
  usePreorden,
  useQuitarPicking,
  type AvisoPedido,
  type ItemPicking,
  type LineaAvance,
} from '@/features/picking/api';
import { errorMessage } from '@/lib/api';
import { colors, radius, shadow } from '@/lib/theme';

type Lectura =
  | { estado: 'procesando'; codigo: string }
  | { estado: 'ok'; codigo: string; producto: string; detalle: string; advertencia: string | null; aviso: AvisoPedido | null }
  | { estado: 'error'; codigo: string; mensaje: string };

function vibrar(tipo: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(tipo);
}

export default function PreordenScreen() {
  const p = useLocalSearchParams<{ id: string; cliente?: string }>();
  if (!p.id) return <Redirect href="/picking" />;
  return <Picking preordenId={p.id} cliente={p.cliente ?? ''} />;
}

/** Alistamiento de una pre-orden: se pistolean las etiquetas y se ve el avance contra la orden de compra. */
function Picking({ preordenId, cliente }: { preordenId: string; cliente: string }) {
  const picking = usePreorden(preordenId);
  const agregar = useAgregarPicking(preordenId);
  const quitar = useQuitarPicking();
  const estado = useEstadoPicking(preordenId);
  const asignacion = useAsignacion();
  const { user } = useAuth();
  const tipo = picking.data?.orden.tipo;

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
  const ordenActiva = picking.data?.orden.activa ?? true;
  // Mientras carga se asume asignada (el servidor valida igual cada lectura).
  const mia = !picking.data || picking.data.asignado?.id === user?.id;
  const miaRef = useRef(mia);
  miaRef.current = mia;

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
  const pre = picking.data;
  const conOc = !!pre?.lineasTotal;
  const avance = useMemo(
    () => (picking.data?.avance ?? []).filter((a) => a.kgPedidos !== null || a.empaques > 0),
    [picking.data],
  );
  const pendientesOc = avance.filter((a) => a.kgPedidos !== null && a.kgAlistados < a.kgPedidos);

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
      if (!miaRef.current) {
        throw new Error('La pre-orden no está asignada a ti.');
      }
      if (terminadoRef.current) {
        throw new Error('La pre-orden está terminada. Reábrela para seguir alistando.');
      }
      if (tipo === 'traslado' && !/^[1-9]\d{7}$/.test(codigo)) {
        throw new Error('El código debe ser el de una etiqueta de pieza o canastilla (8 dígitos).');
      }
      const item = await agregar.mutateAsync(codigo);
      const detalle = [item.tipo === 'canastilla' ? 'Canastilla' : 'Pieza', `${item.unds} und`, `${kg(item.netoEtiquetaKg)} kg`].join(' · ');
      const aviso = item.avisoPedido ?? null;
      setLectura({
        estado: 'ok',
        codigo: item.codigo,
        producto: item.productoNombre,
        detalle,
        advertencia: item.advertenciaInventario,
        aviso,
      });
      vibrar(
        item.advertenciaInventario || (aviso && aviso.tipo !== 'completo')
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
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
    alerta('Quitar etiqueta', `¿Quitar ${item.codigo} (${item.productoNombre}, ${kg(item.netoEtiquetaKg)} kg) de la pre-orden?`, [
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

  function liberar() {
    alerta('Liberar pre-orden', 'Dejas de tenerla asignada y otro alistador la podrá tomar. Lo alistado se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Liberar',
        style: 'destructive',
        onPress: () =>
          asignacion.mutate(
            { id: preordenId, accion: 'liberar' },
            {
              onSuccess: () => router.back(),
              onError: (err) => Alert.alert('No se pudo liberar', errorMessage(err, 'Intenta de nuevo.')),
            },
          ),
      },
    ]);
  }

  function cambiarEstado(accion: 'terminar' | 'reabrir') {
    const terminar = accion === 'terminar';
    alerta(
      terminar ? 'Terminar pre-orden' : 'Reabrir pre-orden',
      terminar
        ? `${totales.empaques} etiquetas · ${kg(totales.kg)} kg${pre?.porcentaje != null ? ` · ${pre.porcentaje}% de la OC` : ''}.\nQueda lista para pesar los arrumes en escritorio.` +
            (pendientesOc.length
              ? `\n\nOJO: faltan productos de la orden de compra:\n${pendientesOc
                  .map((a) => `• ${a.productoNombre}: ${kg(a.kgAlistados)} de ${kg(a.kgPedidos ?? 0)} kg`)
                  .join('\n')}`
              : '')
        : 'Se podrán volver a agregar o quitar etiquetas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: terminar ? (pendientesOc.length ? 'Terminar igual' : 'Terminar') : 'Reabrir',
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
          <Text style={styles.numeroText}>{pre?.orden.numero ?? '…'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cliente} numberOfLines={1}>
            {pre?.nombre ?? 'Cargando…'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[pre?.ocNumero ? `OC ${pre.ocNumero}` : 'Sin orden de compra', cliente].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {picking.data && (
          <View style={[styles.estado, terminado ? styles.estadoTerminado : styles.estadoCurso]}>
            <Text style={[styles.estadoText, { color: terminado ? '#15803D' : colors.amber }]}>
              {terminado ? 'Terminado' : 'En curso'}
            </Text>
          </View>
        )}
        {picking.data && mia && (
          <Pressable onPress={liberar} disabled={asignacion.isPending} style={styles.liberar} accessibilityLabel="Liberar pre-orden">
            <Text style={styles.liberarText}>Liberar</Text>
          </Pressable>
        )}
      </View>

      {conOc && pre && <AvanceOc porcentaje={pre.porcentaje ?? 0} completas={pre.lineasCompletas} total={pre.lineasTotal} kgPedidos={pre.kgPedidos} />}

      <View style={styles.totales}>
        <Total label="Empaques" valor={String(totales.empaques)} />
        <Total label="Unds" valor={String(totales.unds)} />
        <Total label="Kg etiqueta" valor={kg(totales.kg)} color={colors.success} />
        <Total label="Pesados" valor={`${totales.pesados}/${totales.empaques}`} />
      </View>

      {!ordenActiva ? (
        <Aviso icono={<LockKeyhole size={22} color={colors.mutedForeground} />} titulo="Orden cerrada" texto="La orden ya no está activa." />
      ) : !mia ? (
        <Aviso
          icono={<LockKeyhole size={22} color={colors.mutedForeground} />}
          titulo="No está asignada a ti"
          texto={pre?.asignado ? `La tiene ${pre.asignado.nombre}.` : 'Vuelve y asígnatela para alistar.'}
        />
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
              {v === 'producto'
                ? conOc
                  ? `Pedido OC (${pre?.lineasCompletas}/${pre?.lineasTotal})`
                  : `Por producto (${porProducto.length})`
                : `Etiquetas (${lista.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.listaBox} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {vista === 'producto' && conOc ? (
          <>
            {pre?.observaciones ? (
              <View style={styles.ocHeader}>
                <Text style={styles.meta} numberOfLines={2}>
                  {pre.observaciones}
                </Text>
              </View>
            ) : null}
            {avance.map((a) => (
              <FilaPedido key={a.productoId} linea={a} />
            ))}
          </>
        ) : !lista.length ? (
          <Text style={styles.vacio}>
            {picking.isLoading ? 'Cargando…' : picking.isError ? errorMessage(picking.error, 'No se pudo cargar la pre-orden.') : 'Aún no hay etiquetas alistadas.'}
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
                ordenActiva &&
                mia && (
                  <Pressable onPress={() => confirmarQuitar(i)} style={styles.iconBtn} accessibilityLabel={`Quitar ${i.codigo}`}>
                    <Trash2 size={18} color={colors.destructive} />
                  </Pressable>
                )
              )}
            </View>
          ))
        )}
      </ScrollView>

      {ordenActiva && mia && !terminado && lista.length > 0 && (
        <Button title="Terminar pre-orden" onPress={() => cambiarEstado('terminar')} disabled={estado.isPending} />
      )}
    </View>
  );
}

/** Avance de un producto de la orden de compra: kilos alistados (etiqueta) contra kilos pedidos. */
function FilaPedido({ linea }: { linea: LineaAvance }) {
  const pedido = linea.kgPedidos;
  const fuera = pedido === null;
  const excedido = !fuera && linea.kgAlistados > pedido;
  const completo = !fuera && linea.kgAlistados >= pedido;
  const pct = fuera ? 100 : pedido > 0 ? Math.min(linea.kgAlistados / pedido, 1) * 100 : 0;
  const color = fuera || excedido ? colors.amber : completo ? colors.success : colors.primary;
  return (
    <View
      style={[
        styles.fila,
        { flexDirection: 'column', alignItems: 'stretch', gap: 5, paddingVertical: 8 },
        fuera || excedido ? styles.filaAviso : completo ? styles.filaCompleta : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {completo && !excedido ? (
          <CircleCheck size={18} color={colors.success} />
        ) : fuera || excedido ? (
          <TriangleAlert size={18} color={colors.amber} />
        ) : null}
        <Text style={[styles.producto, { flex: 1 }]} numberOfLines={1}>
          {linea.productoNombre}
        </Text>
        <Text style={[styles.kg, { color }]}>
          {kg(linea.kgAlistados)}
          <Text style={styles.ocDe}>{fuera ? ' kg' : ` / ${kg(pedido)}`}</Text>
        </Text>
      </View>
      <View style={styles.barra}>
        <View style={[styles.barraLlena, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.meta, (fuera || excedido) && { color: '#92400E', fontWeight: '600' }]}>
        {linea.productoCodigo} · {linea.empaques} emp.
        {fuera
          ? ' · No está en la orden de compra'
          : excedido
            ? ` · Excede ${kg(linea.kgAlistados - pedido)} kg`
            : completo
              ? ' · Completo'
              : ` · Faltan ${kg(pedido - linea.kgAlistados)} kg`}
      </Text>
    </View>
  );
}

/** % de la orden de compra alistado (kilos de etiqueta, tope por producto, sobre kilos pedidos). */
function AvanceOc({ porcentaje, completas, total, kgPedidos }: { porcentaje: number; completas: number; total: number; kgPedidos: number }) {
  const listo = porcentaje >= 100;
  const color = listo ? colors.success : colors.primary;
  return (
    <View style={[styles.avance, listo && { borderColor: colors.green200, backgroundColor: colors.green50 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={[styles.avancePct, { color }]}>{porcentaje.toLocaleString('es-CO')}%</Text>
        <Text style={[styles.meta, { flex: 1 }]} numberOfLines={1}>
          de la orden de compra · {completas}/{total} productos · {kg(kgPedidos)} kg
        </Text>
      </View>
      <View style={[styles.barra, { height: 10, borderRadius: 5 }]}>
        <View style={[styles.barraLlena, { height: 10, borderRadius: 5, width: `${Math.min(porcentaje, 100)}%`, backgroundColor: color }]} />
      </View>
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
      {lectura.aviso && (
        <View
          style={[
            styles.resultado,
            lectura.aviso.tipo === 'completo'
              ? { borderColor: colors.green200, backgroundColor: colors.green50 }
              : { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
          ]}
        >
          {lectura.aviso.tipo === 'completo' ? (
            <CircleCheck size={20} color={colors.success} />
          ) : (
            <TriangleAlert size={20} color={colors.amber} />
          )}
          <Text style={[styles.resultadoText, { flex: 1, color: lectura.aviso.tipo === 'completo' ? '#15803D' : '#92400E' }]}>
            {lectura.aviso.mensaje}
          </Text>
        </View>
      )}
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
  ocHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  filaCompleta: { backgroundColor: '#DCFCE7' },
  filaAviso: { backgroundColor: '#FFFBEB' },
  avance: { gap: 6, padding: 10, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...shadow.sm },
  avancePct: { fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ocDe: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground },
  barra: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  barraLlena: { height: 6, borderRadius: 3 },
  liberar: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.red200 },
  liberarText: { fontSize: 12, fontWeight: '700', color: colors.red700, textTransform: 'uppercase' },
  pesado: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.md, backgroundColor: colors.green50 },
  pesadoText: { fontSize: 10, fontWeight: '700', color: '#15803D', textTransform: 'uppercase' },
});
