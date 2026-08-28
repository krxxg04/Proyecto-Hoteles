export const ESTADOS_CUARTO = [
  'libre', 'ocupada', 'checkout', 'limpieza', 'inspeccion', 'lista', 'mantenimiento',
] as const;
export type EstadoCuarto = (typeof ESTADOS_CUARTO)[number];

export const ETIQUETA_ESTADO: Record<EstadoCuarto, string> = {
  libre: 'Disponible',
  ocupada: 'Ocupada',
  checkout: 'Check-out',
  limpieza: 'En limpieza',
  inspeccion: 'Inspección',
  lista: 'Lista',
  mantenimiento: 'Mantenimiento',
};

export type TipoCuarto = {
  id: string;
  nombre: string;
  aforo: number;
  costo: number;
  horas_lj: number;
  horas_vd: number;
  hora_extra: number;
  amanecida: number;
  amanecida_vd: number;
  deposito: number;
  activo: boolean;
};

export type Cuarto = {
  id: string;
  numero: string;
  tipo_id: string;
  estado: EstadoCuarto;
  nota: string | null;
  aforo: number;
  caracteristicas: string[];
  tarifa_costo: number | null;
  tarifa_amanecida: number | null;
  activo: boolean;
};

export type CuartoConTipo = Cuarto & { tipo: string };

export type CuartoSugerido = {
  cuarto_id: string;
  numero: string;
  tipo: string;
  aforo: number;
  coincidencias: number;
};

/** Lo que enseña el panel lateral de una habitación. */
export type DetalleCuarto = Cuarto & {
  tipos_cuarto: { nombre: string; aforo: number; costo: number; amanecida: number } | null;
  estadia: {
    id: string;
    fecha_entrada: string;
    fecha_salida: string | null;
    personas: number;
    tarifa_total: number;
    estado: string;
    huespedes: { nombre: string; num_doc: string } | null;
  } | null;
  ultima_limpieza: { created_at: string; profiles: { nombre: string } | null } | null;
  proxima_reserva: {
    id: string;
    fecha_entrada: string;
    personas: number;
    nombre_contacto: string | null;
  } | null;
};
