/**
 * Reservas. El mockup tenía la sección con un estado vacío y `plan.md` la dejó como
 * pendiente («Vista Reservas completa: calendario/lista»). La tabla ya estaba en el
 * esquema desde el principio.
 *
 * Una reserva NO bloquea la habitación: hasta que alguien llega y hace el check-in, el
 * cuarto se puede vender. Bloquearlo al reservar sería regalar noches en un hostal donde
 * la mitad de la gente no aparece.
 */

export const ESTADOS_RESERVA = [
  'pendiente',
  'confirmada',
  'cancelada',
  'no_show',
  'convertida',
] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ETIQUETA_RESERVA: Record<EstadoReserva, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  no_show: 'No se presentó',
  convertida: 'Ya entró',
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
  /** Incrustados, para no pedir el tipo y el cuarto por separado. */
  tipos_cuarto?: { nombre: string } | null;
  cuartos?: { numero: string } | null;
};
