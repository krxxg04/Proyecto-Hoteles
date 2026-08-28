import type { MedioPago } from '@/shared/dominio/pago';

export type Venta = {
  id: string;
  turno_id: string | null;
  concepto: string;
  producto_id: string | null;
  cantidad: number | null;
  cuarto_id: string | null;
  monto: number;
  medio: MedioPago;
  banco: string | null;
  created_at: string;
};

export type ResumenVentas = {
  total: number;
  por_medio: Record<string, number>;
  cantidad: number;
};

export type MasVendido = { nombre: string; unidades: number; total: number };
