export const CATEGORIAS_PRODUCTO = ['insumo', 'vendible'] as const;
export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTO)[number];

export const CLASES_PRODUCTO = ['descartable', 'no_descartable'] as const;
export type ClaseProducto = (typeof CLASES_PRODUCTO)[number];

export const TIPOS_MOVIMIENTO = [
  'compra', 'entrega', 'venta', 'aseo', 'devolucion_aseo',
  'danio', 'perdida', 'ajuste', 'conteo_cierre',
] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export type Producto = {
  id: string;
  nombre: string;
  icono: string;
  unidad: string;
  stock: number;
  stock_max: number;
  /** Avisar cuando el stock baje de aquí. 0 = sin aviso. */
  stock_min: number;
  categoria: CategoriaProducto;
  clase: ClaseProducto;
  precio: number;
  activo: boolean;
};

export type ProductoConCobertura = Producto & {
  /** % de llenado respecto al máximo. */
  nivel: number;
  /** Días estimados de cobertura, según el consumo real de los últimos 14 días. */
  dias: number | null;
  semaforo: 'danger' | 'warning' | 'success';
  /** El stock tocó o bajó del mínimo configurado. Es lo que dispara la alerta. */
  bajoMinimo: boolean;
};
