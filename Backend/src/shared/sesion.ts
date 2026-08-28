import 'server-only';
import { clienteServidor } from './supabase/servidor';
import type { Rol } from './dominio/rol';

export type Sesion = {
  usuarioId: string;
  tenantId: string;
  rol: Rol;
  nombre: string;
  dni: string;
  /** Nombre y plan del hostal. Solo los rellena `miSesion()`: cuestan una consulta. */
  hostal?: string;
  plan?: 'base' | 'premium';
};

/** `tenant_id` y `rol` viajan en el JWT, así que leerlos no cuesta consulta. Cae al perfil si faltan. */
export async function sesionActual(): Promise<Sesion | null> {
  const supabase = await clienteServidor();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = (user.app_metadata ?? {}) as { tenant_id?: string; rol?: Rol };

  if (meta.tenant_id && meta.rol) {
    const um = (user.user_metadata ?? {}) as { nombre?: string; dni?: string };
    return {
      usuarioId: user.id,
      tenantId: meta.tenant_id,
      rol: meta.rol,
      nombre: um.nombre ?? '',
      dni: um.dni ?? '',
    };
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('tenant_id, rol, nombre, dni')
    .eq('id', user.id)
    .single();

  if (!perfil) return null;

  return {
    usuarioId: user.id,
    tenantId: perfil.tenant_id,
    rol: perfil.rol,
    nombre: perfil.nombre,
    dni: perfil.dni,
  };
}

export async function exigirSesion(): Promise<Sesion> {
  const sesion = await sesionActual();
  if (!sesion) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return sesion;
}

/** Para dar mensajes claros, NO es la seguridad: esa son el RLS y las funciones SQL. */
export async function exigirRol(...roles: Rol[]): Promise<Sesion> {
  const sesion = await exigirSesion();
  if (!roles.includes(sesion.rol)) {
    throw new Error('No tienes permiso para hacer esto.');
  }
  return sesion;
}

/** Quiénes manejan dinero: caja, ventas, check-in, turnos. */
export const ROLES_CAJA: Rol[] = ['administrador', 'recepcion'];

/** Solo administración: tarifario, personal, configuración. */
export const ROLES_ADMIN: Rol[] = ['administrador'];
