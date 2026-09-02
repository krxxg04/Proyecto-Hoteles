export type Producto = {
  id: string;
  nombre: string;
  icono: string;
  unidad: string;
  stock: number;
  stock_max: number;
  /** Avisar cuando el stock baje de aquí. 0 = sin aviso. */
  stock_min: number;
  categoria: 'insumo' | 'vendible';
  clase: 'descartable' | 'no_descartable';
  precio: number;
  /** Lo que suele costar comprar una unidad. 0 = sin referencia. */
  costo_referencia: number;
  activo: boolean;
  /** % de llenado respecto al máximo. */
  nivel: number;
  /** Días de cobertura según el consumo real de los últimos 14 días. */
  dias: number | null;
  semaforo: 'danger' | 'warning' | 'success';
  /** Tocó o bajó del mínimo. Es lo que dispara la alerta. */
  bajoMinimo: boolean;
};

export type PendienteAseo = {
  id: string;
  cantidad: number;
  enviado_at: string;
  productos: { nombre: string; unidad: string } | null;
  cuartos: { numero: string } | null;
  profiles: { nombre: string } | null;
};
