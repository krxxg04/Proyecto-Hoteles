/** Espejo de `Backend/src/modules/reservas/domain/tipos.ts`. */

export const ESTADOS_RESERVA = [
  'pendiente', 'confirmada', 'cancelada', 'no_show', 'convertida',
] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ETIQUETA_RESERVA: Record<EstadoReserva, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  no_show: 'No se presentó',
  convertida: 'Ya entró',
};

export const TONO_RESERVA: Record<EstadoReserva, 'warning' | 'success' | 'danger' | 'muted' | 'info'> = {
  pendiente: 'warning',
  confirmada: 'success',
  cancelada: 'muted',
  no_show: 'danger',
  convertida: 'info',
};

export type Reserva = {
  id: string;
  huesped_id: string | null;
  nombre_contacto: string | null;
  telefono: string | null;
  tipo_id: string | null;
  cuarto_id: string | null;
  fecha_entrada: string;
  fecha_salida: string | null;
  personas: number;
  estado: EstadoReserva;
  origen: string | null;
  notas: string | null;
  estadia_id: string | null;
  created_at: string;
  tipos_cuarto?: { nombre: string } | null;
  cuartos?: { numero: string } | null;
};
