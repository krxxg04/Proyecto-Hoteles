import { clienteServidor } from '@/shared/supabase/servidor';
import type { Catalogo } from '../domain/tarjeta';

/**
 * Números de habitación y nombres de producto del hostal. Pasa por RLS como todo lo demás.
 *
 * Trae también `estado` y `aforo` de cada cuarto, y no por completitud: son lo que permite
 * decir «la 102 está ocupada» **cuando se dice el número**, en vez de aceptar el dato,
 * seguir preguntando el nombre y el documento del huésped, y reventar al confirmar. Un
 * DNI recogido para nada es justo lo que la Ley 29733 no permite pedir «por si acaso».
 */
export async function cargarCatalogo(): Promise<Catalogo> {
  const supabase = await clienteServidor();

  const [cuartos, productos] = await Promise.all([
    supabase.from('cuartos').select('id, numero, estado, aforo').eq('activo', true).order('numero'),
    supabase.from('productos').select('id, nombre, categoria, unidad').eq('activo', true).order('nombre'),
  ]);

  return {
    cuartos: (cuartos.data ?? []) as Catalogo['cuartos'],
    productos: (productos.data ?? []) as Catalogo['productos'],
  };
}
