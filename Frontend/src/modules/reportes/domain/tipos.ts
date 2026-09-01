export type ProductoEnAviso = {
  nombre: string;
  dias: number | null;
  nivel: number;
  unidad: string;
  stock: number;
  stock_min: number;
  bajoMinimo: boolean;
};

/** Espejo de `Backend/src/modules/reportes/domain/tipos.ts`. El contrato lo fija `/api/openapi`. */

/** Una barra de las dos listas de «Consumo del hostal». */
export type LineaConsumo = { nombre: string; cantidad: number; unidad?: string };

export type ResumenPanel = {
  cuartos: {
    total: number;
    ocupados: number;
    disponibles: number;
    listas: number;
    porLimpiar: number;
  };
  ocupacion: number;
  ingresosHoy: number;
  ingresosAyer: number;
  ventasHoy: number;
  checkinsHoy: number;
  checkoutsHoy: number;
  incidenciasAbiertas: number;
  stockCritico: number;

  /**
   * Últimos 14 días para las minigráficas. Solo hay serie de lo que se puede
   * reconstruir del histórico: «habitaciones listas» va sin ella a propósito.
   */
  series: { checkins: number[]; checkouts: number[]; ventas: number[] };

  consumo: { productos: LineaConsumo[]; tipos: LineaConsumo[] };

  /** El insumo a reponer antes. `dias` es null si no hay consumo del que estimarlo. */
  porAcabarse: ProductoEnAviso | null;
  /** Los que ya tocaron su mínimo, del más corto de stock al menos. */
  bajoMinimo: ProductoEnAviso[];
};
