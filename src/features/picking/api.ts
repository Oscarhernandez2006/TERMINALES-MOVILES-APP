import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Tipos de orden que se alistan en la terminal (mismas órdenes de escritorio: Despacho Posta y Traslado). */
export type TipoPicking = 'posta' | 'traslado';

export interface OrdenPicking {
  id: string;
  numero: string;
  processDate: string;
  cliente: { id: string; nit: string | null; concepto: string };
}

export type EstadoPicking = 'en_curso' | 'terminado';

/** Etiqueta alistada en el picking. `pesado`: ya se registró en la orden al pesar su arrume. */
export interface ItemPicking {
  id: string;
  codigo: string;
  tipo: string;
  productoCodigo: string;
  productoNombre: string;
  unds: number;
  netoEtiquetaKg: number;
  createdAt: string;
  pesado: boolean;
}

export interface LineaAvance {
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  plu: string | null;
  productoCliente: string | null;
  /** null: el producto no está en la orden de compra del cliente. */
  kgPedidos: number | null;
  empaques: number;
  kgAlistados: number;
  kgPesados: number;
  completo: boolean;
}

/** Pre-orden: lo que se alista para una orden de compra del cliente (una tienda) o sin OC. */
export interface PreordenResumen {
  id: string;
  nombre: string;
  ocNumero: string | null;
  tiendaCodigo: string | null;
  tiendaNombre: string | null;
  observaciones: string | null;
  /** Alistador que tiene la pre-orden: solo él la alista hasta liberarla. */
  asignado: { id: string; nombre: string } | null;
  asignadoAt: string | null;
  status: EstadoPicking;
  terminadoAt: string | null;
  empaques: number;
  porPesar: number;
  kgPedidos: number;
  kgAlistados: number;
  kgCumplidos: number;
  /** % de la orden de compra alistado (por kilos); null sin orden de compra. */
  porcentaje: number | null;
  lineasCompletas: number;
  lineasTotal: number;
  /** Líneas de la orden de compra de la tienda con lo alistado. */
  avance: LineaAvance[];
}

export interface Preorden extends PreordenResumen {
  items: ItemPicking[];
  orden: { tipo: TipoPicking; id: string; numero: string; activa: boolean };
}

export interface PickingOrden {
  orden: string;
  ordenActiva: boolean;
  porcentaje: number | null;
  kgPedidos: number;
  preordenes: PreordenResumen[];
  items: (ItemPicking & { preordenId: string; preorden: string; listo: boolean })[];
}

export interface AvisoPedido {
  tipo: 'fuera' | 'excedido' | 'completo';
  mensaje: string;
}

export type ItemAgregado = ItemPicking & { advertenciaInventario: string | null; avisoPedido: AvisoPedido | null };

interface TipoConfig {
  titulo: string;
  prefijo: string;
  base: string;
  listar: { url: string; params: Record<string, string | number>; numero: (o: Record<string, unknown>) => unknown };
}

export const TIPOS: Record<TipoPicking, TipoConfig> = {
  posta: {
    titulo: 'Despacho posta',
    prefijo: 'DC',
    base: 'canal-dispatch-orders',
    listar: {
      url: '/canal-dispatch-orders',
      params: { tipo: 'posta', status: 'activo', pageSize: 100 },
      numero: (o) => o.dcNumber,
    },
  },
  traslado: {
    titulo: 'Traslados',
    prefijo: 'OT',
    base: 'transfer-orders',
    listar: {
      url: '/transfer-orders',
      params: { status: 'activo', pageSize: 100 },
      numero: (o) => o.otNumber,
    },
  },
};

export function esTipoPicking(v: unknown): v is TipoPicking {
  return v === 'posta' || v === 'traslado';
}

export function useOrdenesPicking(tipo: TipoPicking) {
  const cfg = TIPOS[tipo];
  return useQuery({
    queryKey: [cfg.base, 'activas', 'picking'],
    refetchInterval: 15_000,
    queryFn: async (): Promise<OrdenPicking[]> => {
      const { data } = await api.get<{ data: Record<string, unknown>[] }>(cfg.listar.url, { params: cfg.listar.params });
      return data.data.map((o) => ({
        id: o.id as string,
        numero: `${cfg.prefijo}${String(cfg.listar.numero(o))}`,
        processDate: o.processDate as string,
        cliente: o.cliente as OrdenPicking['cliente'],
      }));
    },
  });
}

/** Pre-órdenes de la orden con su avance. */
export function usePicking(tipo: TipoPicking, ordenId: string) {
  return useQuery({
    queryKey: ['picking', tipo, ordenId],
    refetchInterval: 10_000,
    queryFn: async () => (await api.get<PickingOrden>(`/picking/${tipo}/${ordenId}`)).data,
  });
}

export function usePreorden(id: string) {
  return useQuery({
    queryKey: ['picking', 'preorden', id],
    refetchInterval: 10_000,
    queryFn: async () => (await api.get<Preorden>(`/picking/preordenes/${id}`)).data,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['picking'] });
}

/** Pre-orden sin orden de compra (si ya existe, el servidor devuelve esa). */
export function useCrearPreordenGeneral(tipo: TipoPicking, ordenId: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async () => (await api.post<Preorden>(`/picking/${tipo}/${ordenId}/preordenes`, { lineas: [] })).data,
    onSettled: invalidar,
  });
}

/** Se asigna (o libera) la pre-orden al alistador de la terminal. */
export function useAsignacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, accion }: { id: string; accion: 'asignar' | 'liberar' }) => {
      await api.patch(`/picking/preordenes/${id}/${accion}`);
    },
    onSettled: invalidar,
  });
}

/** Agrega la etiqueta a la pre-orden: no se registra en la orden hasta pesar el arrume. */
export function useAgregarPicking(preordenId: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (codigo: string) =>
      (await api.post<ItemAgregado>(`/picking/preordenes/${preordenId}/items`, { codigo })).data,
    onSettled: invalidar,
  });
}

export function useQuitarPicking() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/picking/items/${itemId}`);
    },
    onSettled: invalidar,
  });
}

/** Termina la pre-orden (queda lista para pesar en escritorio) o la reabre para seguir alistando. */
export function useEstadoPicking(preordenId: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (accion: 'terminar' | 'reabrir') => {
      await api.patch(`/picking/preordenes/${preordenId}/${accion}`);
    },
    onSettled: invalidar,
  });
}

/** Agrupa lo alistado por producto: empaques (etiquetas), unidades y kilos de etiqueta. */
export function agruparPorProducto(items: ItemPicking[]) {
  const m = new Map<
    string,
    { codigo: string; producto: string; empaques: number; pesados: number; unds: number; kg: number }
  >();
  for (const i of items) {
    const g = m.get(i.productoCodigo) ?? {
      codigo: i.productoCodigo,
      producto: i.productoNombre,
      empaques: 0,
      pesados: 0,
      unds: 0,
      kg: 0,
    };
    g.empaques += 1;
    if (i.pesado) g.pesados += 1;
    g.unds += i.unds;
    g.kg += i.netoEtiquetaKg;
    m.set(i.productoCodigo, g);
  }
  return [...m.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
}

export const kg = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
