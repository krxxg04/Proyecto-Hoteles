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
   * Series de los últimos 14 días para las minigráficas.
   *
   * Solo hay serie de lo que de verdad se puede reconstruir del histórico. El mockup
   * dibujaba cuatro sparklines con datos inventados; una gráfica falsa en un panel de
   * gestión es peor que ninguna, así que «habitaciones listas» va sin ella.
   */
  series: { checkins: number[]; checkouts: number[]; ventas: number[] };

  /** «Consumo del hostal»: qué se gasta y qué tipo de cuarto se vende. */
  consumo: { productos: LineaConsumo[]; tipos: LineaConsumo[] };

  /**
   * El insumo que hay que reponer antes.
   *
   * `dias` es `null` cuando no hay consumo del que estimarlo: un producto al 18 % del
   * que nadie ha sacado nada sigue siendo el más urgente, aunque no se pueda decir
   * cuánto dura. Saltárselo por falta de histórico era esconder justo lo que importa.
   */
  porAcabarse: { nombre: string; dias: number | null; nivel: number } | null;
};

export type IngresoDiario = { fecha: string; total: number; operaciones: number };

export type ReporteOcupacion = {
  estadias: number;
  nochesVendidas: number;
  porHoras: number;
  huespedes: number;
  ingresos: number;
  ticketPromedio: number;
};
