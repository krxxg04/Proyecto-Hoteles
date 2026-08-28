export type Producto = {
  id: string;
  nombre: string;
  icono: string;
  unidad: string;
  stock: number;
  stock_max: number;
  categoria: 'insumo' | 'vendible';
  clase: 'descartable' | 'no_descartable';
  precio: number;
  activo: boolean;
  /** % de llenado respecto al máximo. */
  nivel: number;
  /** Días de cobertura según el consumo real de los últimos 14 días. */
  dias: number | null;
  semaforo: 'danger' | 'warning' | 'success';
};

export type PendienteAseo = {
  id: string;
  cantidad: number;
  enviado_at: string;
  productos: { nombre: string; unidad: string } | null;
  cuartos: { numero: string } | null;
  profiles: { nombre: string } | null;
};
