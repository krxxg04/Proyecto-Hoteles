import type { Producto, ProductoConCobertura } from './tipos';

/** Cobertura de stock. Puro: recibe el consumo ya medido, no consulta nada. */
export function conCobertura(
  producto: Producto,
  consumidoEn14Dias: number
): ProductoConCobertura {
  const nivel = producto.stock_max > 0 ? producto.stock / producto.stock_max : 0;
  const porDia = consumidoEn14Dias / 14;

  return {
    ...producto,
    nivel: Math.round(nivel * 100),
    dias: porDia > 0 ? Math.max(0, Math.round(producto.stock / porDia)) : null,
    semaforo: nivel < 0.25 ? 'danger' : nivel < 0.5 ? 'warning' : 'success',
  };
}
