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

export interface Picking {
  id: string | null;
  orden: string;
  ordenActiva: boolean;
  status: EstadoPicking;
  terminadoAt: string | null;
  items: ItemPicking[];
}

export type ItemAgregado = ItemPicking & { advertenciaInventario: string | null };

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

const pickingKey = (tipo: TipoPicking, ordenId: string) => ['picking', tipo, ordenId];

export function usePicking(tipo: TipoPicking, ordenId: string) {
  return useQuery({
    queryKey: pickingKey(tipo, ordenId),
    refetchInterval: 10_000,
    queryFn: async () => (await api.get<Picking>(`/picking/${tipo}/${ordenId}`)).data,
  });
}

/** Agrega la etiqueta al picking (pre-orden): no se registra en la orden hasta pesar el arrume. */
export function useAgregarPicking(tipo: TipoPicking, ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (codigo: string) =>
      (await api.post<ItemAgregado>(`/picking/${tipo}/${ordenId}/items`, { codigo })).data,
    onSettled: () => qc.invalidateQueries({ queryKey: pickingKey(tipo, ordenId) }),
  });
}

export function useQuitarPicking(tipo: TipoPicking, ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/picking/items/${itemId}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: pickingKey(tipo, ordenId) }),
  });
}

/** Termina el picking (queda listo para pesar en escritorio) o lo reabre para seguir alistando. */
export function useEstadoPicking(tipo: TipoPicking, ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accion: 'terminar' | 'reabrir') => {
      await api.patch(`/picking/${tipo}/${ordenId}/${accion}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: pickingKey(tipo, ordenId) }),
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
