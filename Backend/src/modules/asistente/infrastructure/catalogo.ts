import { clienteServidor } from '@/shared/supabase/servidor';
import type { Catalogo } from '../domain/tarjeta';

/** Números de habitación y nombres de producto del hostal. Pasa por RLS como todo lo demás. */
export async function cargarCatalogo(): Promise<Catalogo> {
  const supabase = await clienteServidor();

  const [cuartos, productos] = await Promise.all([
    supabase.from('cuartos').select('id, numero').eq('activo', true).order('numero'),
    supabase.from('productos').select('id, nombre, categoria, unidad').eq('activo', true).order('nombre'),
  ]);

  return {
    cuartos: (cuartos.data ?? []) as Catalogo['cuartos'],
    productos: (productos.data ?? []) as Catalogo['productos'],
  };
}
