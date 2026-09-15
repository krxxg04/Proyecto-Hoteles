import type { MedioPago } from '@/shared/dominio/tipos';

export type Turno = {
  id: string;
  usuario_id: string;
  estado: 'abierto' | 'cerrado';
  abierto_at: string;
  cerrado_at: string | null;
  sencillo_esperado: number;
  sencillo_apertura: number;
  sencillo_dejado: number | null;
};

export type EstadoCaja = {
  turno: Turno | null;
  /** Una sola caja: lo que dejó el último cierre. */
  saldo: number;
  /** Lo que debería haber ahora: apertura + ventas en efectivo − gastos en efectivo. */
  efectivo_esperado: number;
  gastos_turno: number;
  usuario: string | null;
  es_de_otro: boolean;
};

/**
 * `fijo`: comprar un producto del catálogo — "Gastos listados".
 * `recurrente`: no está en el catálogo pero se repite — gas, un plomero, escobas.
 * `otro`: tampoco está en el catálogo, y no se espera — un pinchazo, algo puntual.
 */
export const CATEGORIAS_GASTO = ['fijo', 'recurrente', 'otro'] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

/** Un solo lugar para el texto de cada categoría: el botón, la insignia y el diálogo lo repiten. */
export const ETIQUETA_CATEGORIA_GASTO: Record<CategoriaGasto | 'justificable', string> = {
  fijo: 'Gasto listado',
  recurrente: 'Gasto recurrente',
  otro: 'Otro gasto',
  // Filas de antes de separar `recurrente` y `otro`.
  justificable: 'Otro gasto',
};

export type Gasto = {
  id: string;
  /** Las filas de antes de esta migración pueden traer el `justificable` original. */
  categoria: CategoriaGasto | 'justificable';
  producto_id: string | null;
  cantidad: number | null;
  concepto: string;
  monto: number;
  medio: MedioPago;
  justificacion: string | null;
  created_at: string;
  productos: { nombre: string; unidad: string } | null;
  profiles: { nombre: string } | null;
};

export type Alerta = {
  id: string;
  severidad: 'info' | 'warning' | 'danger';
  titulo: string;
  detalle: string | null;
  origen: string | null;
  atendida: boolean;
  /** Cuando y quien la atendio. Van juntos: una fecha sin nombre no cierra nada. */
  atendida_at: string | null;
  atendida_por_nombre: string | null;
  requiere_validacion: boolean;
  created_at: string;
};

export type ResumenVentas = {
  total: number;
  por_medio: Record<string, number>;
  cantidad: number;
};

/** Qué debería haber de cada producto al cerrar. */
export type LineaConteo = {
  producto_id: string;
  nombre: string;
  unidad: string;
  apertura: number;
  esperado: number;
};

export type ResumenCierre = {
  cierre_id: string;
  recaudado: number;
  por_medio: Partial<Record<MedioPago, number>>;
  por_banco: Record<string, number>;
  gastos: number;
  gastos_efectivo: number;
  efectivo_esperado: number;
  efectivo_contado: number;
  /** Positiva si falta dinero, negativa si sobra. */
  diferencia_caja: number;
  saldo_nuevo: number;
  incidencias: number;
};

export type Incidencia = {
  id: string;
  turno_id: string | null;
  producto_id: string | null;
  concepto: string;
  unidad: string;
  esperado: number;
  contado: number;
  diferencia: number;
  justificacion: string;
  estado: 'abierta' | 'revisada';
  created_at: string;
};
