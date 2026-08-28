import type { PostgrestError } from '@supabase/supabase-js';

/** Lo que devuelve todo caso de uso. Nunca lanza hacia el frontend. */
export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campo?: string };

export function exito<T>(datos: T): Resultado<T> {
  return { ok: true, datos };
}

export function fallo<T = never>(error: string, campo?: string): Resultado<T> {
  return { ok: false, error, campo };
}

/** Traduce un error de Postgres. Los mensajes de las funciones SQL ya vienen redactados. */
export function traducirError(error: PostgrestError | Error | unknown): string {
  if (!error) return 'Ocurrió un error inesperado.';

  const e = error as PostgrestError;
  const mensaje = e.message ?? String(error);

  switch (e.code) {
    case '23505': // unicidad
      if (mensaje.includes('numero_unico')) return 'Ya existe un cuarto con ese número.';
      if (mensaje.includes('productos_nombre')) return 'Ya existe un producto con ese nombre.';
      if (mensaje.includes('huespedes_doc')) return 'Ya hay un huésped registrado con ese documento.';
      if (mensaje.includes('profiles_dni')) return 'Ya hay alguien registrado con ese DNI.';
      if (mensaje.includes('turnos_uno_abierto')) return 'Ya hay un turno abierto en este hostal.';
      return 'Ese registro ya existe.';

    case '23503': // clave foránea
      return 'No se puede completar: hay otro registro que depende de este.';

    case '23514': // check constraint
      return 'Alguno de los datos está fuera del rango permitido.';

    case '42501': // el RLS hizo su trabajo
      return 'No tienes permiso para hacer esto.';

    case 'PGRST116': // sin filas cuando se esperaba una
      return 'No se encontró el registro. Puede que ya no exista o sea de otro hostal.';
  }

  if (mensaje) return mensaje;
  return 'Ocurrió un error inesperado.';
}
