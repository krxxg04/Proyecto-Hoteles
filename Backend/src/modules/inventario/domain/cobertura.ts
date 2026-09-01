import type { Producto, ProductoConCobertura } from './tipos';

/**
 * Cobertura de stock. Puro: recibe el consumo ya medido, no consulta nada.
 *
 * El umbral es el `stock_min` de cada producto, no un porcentaje del máximo. Un 25 % de
 * 120 rollos y un 25 % de 60 sábanas son avisos muy distintos, y quien lleva el hostal es
 * quien sabe con cuánto le da tiempo a reponer. Sin mínimo configurado se mantiene la
 * regla vieja, para que un producto sin tocar no se quede de golpe sin aviso.
 */
export function conCobertura(
  producto: Producto,
  consumidoEn14Dias: number
): ProductoConCobertura {
  const nivel = producto.stock_max > 0 ? producto.stock / producto.stock_max : 0;
  const porDia = consumidoEn14Dias / 14;
  const min = Number(producto.stock_min) || 0;

  // Ámbar antes de llegar al mínimo: avisar justo al tocarlo no da margen para comprar.
  const semaforo =
    min > 0
      ? producto.stock <= min
        ? 'danger'
        : producto.stock <= min * 1.5
          ? 'warning'
          : 'success'
      : nivel < 0.25
        ? 'danger'
        : nivel < 0.5
          ? 'warning'
          : 'success';

  return {
    ...producto,
    nivel: Math.round(nivel * 100),
    dias: porDia > 0 ? Math.max(0, Math.round(producto.stock / porDia)) : null,
    semaforo,
    bajoMinimo: min > 0 && producto.stock <= min,
  };
}
