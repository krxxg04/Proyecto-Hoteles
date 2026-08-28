export const MODOS_ESTADIA = ['horas', 'dia', 'rango'] as const;
export type ModoEstadia = (typeof MODOS_ESTADIA)[number];

export type Estadia = {
  id: string;
  huesped_id: string;
  cuarto_id: string;
  modo: ModoEstadia;
  horas: number | null;
  noches: number | null;
  fecha_entrada: string;
  fecha_salida: string | null;
  hora_entrada: string;
  hora_salida: string | null;
  personas: number;
  tarifa_total: number;
  deposito: number;
  tarifa_detalle: DetalleTarifa;
  estado: 'activa' | 'cerrada' | 'cancelada';
};

/** Lo que devuelve `calcular_tarifa()`. El precio SIEMPRE viene de aquí. */
export type DetalleTarifa = {
  total: number;
  deposito: number;
  moneda: string;
  modo: ModoEstadia;
  detalle: Array<{ concepto: string; monto: number; fin_de_semana?: boolean }>;
};

export type ResultadoCheckin = {
  estadia_id: string;
  huesped_id: string;
  cuarto: string;
  tarifa: DetalleTarifa;
};

/**
 * Checklist de inspección post check-out. Portado de `INSP` en el prototipo.
 *
 * Vive en el dominio y no en la base porque hoy es igual para todos los cuartos.
 * Cuando el hostal quiera configurarlo, se mueve a una tabla y esto queda como
 * el valor por defecto de esa tabla.
 */
export const CHECKLIST_INSPECCION = [
  { item: 'Televisor', icono: 'tv', esperado: 1 },
  { item: 'Control remoto', icono: 'gamepad-2', esperado: 1 },
  { item: 'Almohadas', icono: 'cloud', esperado: 2 },
  { item: 'Toallas', icono: 'shirt', esperado: 2 },
  { item: 'Llaves o tarjeta', icono: 'key-round', esperado: 1 },
  { item: 'Estado general', icono: 'sparkles', esperado: 1 },
] as const;

export type ItemInspeccion = {
  item: string;
  icono?: string;
  esperado: number;
  confirmado: number;
  nota?: string;
};

export type Inspeccion = {
  id: string;
  cuarto_id: string;
  estadia_id: string | null;
  resultado: ItemInspeccion[];
  nota: string | null;
  medio_id: string | null;
  created_at: string;
};

/** Lo que necesita la vista para abrir una inspección: el cuarto, su última estadía y el checklist. */
export type PlantillaInspeccion = {
  cuarto: { id: string; numero: string; estado: string };
  estadia_id: string | null;
  items: ItemInspeccion[];
};
