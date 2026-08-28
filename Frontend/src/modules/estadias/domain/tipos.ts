/** Espejo de `Backend/src/modules/estadias/domain/tipos.ts`. El contrato lo fija `/api/openapi`. */

export const MODOS_ESTADIA = ['horas', 'dia', 'rango'] as const;
export type ModoEstadia = (typeof MODOS_ESTADIA)[number];

export const TIPOS_DOC = ['DNI', 'Pasaporte', 'Carné de extranjería', 'RUC'] as const;
export type TipoDoc = (typeof TIPOS_DOC)[number];

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

export type Acompanante = { nombre: string; tipo_doc?: string; num_doc?: string };

export type EntradaCheckin = {
  cuarto_id: string;
  modo: ModoEstadia;
  horas?: number | null;
  noches?: number | null;
  fecha_entrada?: string;
  personas: number;
  nombre: string;
  tipo_doc: string;
  num_doc: string;
  telefono?: string;
  medio: string;
  banco?: string | null;
  acompanantes: Acompanante[];
};

export type EstadiaActiva = {
  id: string;
  modo: ModoEstadia;
  horas: number | null;
  noches: number | null;
  fecha_entrada: string;
  fecha_salida: string | null;
  hora_entrada: string;
  personas: number;
  tarifa_total: number;
  deposito: number;
  estado: 'activa' | 'cerrada' | 'cancelada';
  cuartos: { id: string; numero: string } | null;
  huespedes: { id: string; nombre: string; tipo_doc: string; num_doc: string; telefono: string | null } | null;
};

/** Cuarto libre que aguanta N personas, con lo bien que encaja. Sale de `sugerir_cuarto()`. */
export type CuartoSugerido = {
  cuarto_id: string;
  numero: string;
  tipo: string;
  aforo: number;
  coincidencias: number;
};

// ------------------------------------------------------------------ inspección

export type ItemInspeccion = {
  item: string;
  icono?: string;
  esperado: number;
  confirmado: number;
  nota?: string;
};

export type PlantillaInspeccion = {
  cuarto: { id: string; numero: string; estado: string };
  estadia_id: string | null;
  items: ItemInspeccion[];
};

export type Inspeccion = {
  id: string;
  cuarto_id: string;
  estadia_id: string | null;
  resultado: ItemInspeccion[];
  nota: string | null;
  medio_id: string | null;
  created_at: string;
  cuartos: { numero: string } | null;
};

export type Catalogos = {
  caracteristicas: Array<{ clave: string; label: string; icono: string }>;
  bancos: Array<{ clave: string; label: string }>;
};
