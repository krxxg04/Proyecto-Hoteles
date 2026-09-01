import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { Producto } from '../domain/tipos';

/** Todo lo que mueve stock pasa por funciones SQL; aquí solo se pide. */
export async function moverStock(entrada: {
  tipo: 'compra' | 'entrega' | 'ajuste';
  producto_id: string;
  cantidad: number;
  cuarto_id?: string;
  motivo?: string;
}): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/inventario', { metodo: 'POST', cuerpo: entrada });
}

/** El monto no viaja: lo pone el catálogo dentro de la base. */
export async function venderProducto(entrada: {
  producto_id: string;
  cantidad: number;
  cuarto_id?: string | null;
  medio: string;
  banco?: string;
}): Promise<Resultado<{ venta_id: string }>> {
  return pedirCliente<{ venta_id: string }>('/api/ventas', { metodo: 'POST', cuerpo: entrada });
}

export async function enviarAAseo(producto_id: string, cantidad = 1): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/aseo', { metodo: 'POST', cuerpo: { producto_id, cantidad } });
}

export async function marcarAseoListo(aseo_id: string): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/aseo', { metodo: 'PATCH', cuerpo: { aseo_id } });
}

/** Alta o edición. Con `id` edita; sin `id` crea. El stock no viaja: solo se mueve con movimientos. */
export async function guardarProducto(
  entrada: Partial<Producto> & { id?: string }
): Promise<Resultado<Producto>> {
  return pedirCliente<Producto>('/api/productos', { metodo: 'POST', cuerpo: entrada });
}

/** Baja lógica: el kardex y las ventas siguen apuntando al producto. */
export async function desactivarProducto(id: string): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/productos', { metodo: 'DELETE', cuerpo: { id } });
}
