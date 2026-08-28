import type { MedioPago } from '@/shared/dominio/pago';

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
  sencillo_esperado: number;
  caja_chica: number;
  usuario: string | null;
  /** El turno abierto lo abrió otra persona. */
  es_de_otro: boolean;
};

/** Una línea del conteo de cierre: qué debería haber vs qué hay. */
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
  efectivo_en_caja: number;
  sencillo_dejado: number;
  a_caja_chica: number;
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
