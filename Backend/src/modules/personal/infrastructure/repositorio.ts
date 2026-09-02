import { clienteServidor } from '@/shared/supabase/servidor';
import { clienteAdmin } from '@/shared/supabase/admin';

export async function buscarPersonal() {
  const supabase = await clienteServidor();
  return supabase
    .from('profiles')
    .select('id, tenant_id, dni, nombre, rol, telefono, activo')
    .order('nombre');
}

export async function slugDelHostal(tenantId: string) {
  const supabase = await clienteServidor();
  return supabase.from('tenants').select('slug').eq('id', tenantId).single();
}

export async function emailDeDni(dni: string, slug: string) {
  const supabase = await clienteServidor();
  return supabase.rpc('email_de_dni', { p_dni: dni, p_slug: slug });
}

/** `service_role`: el rol y el hostal ya se verificaron en el caso de uso. */
export async function crearUsuario(p: {
  email: string;
  pin: string;
  tenantId: string;
  dni: string;
  nombre: string;
  rol: string;
  telefono: string | null;
}) {
  return clienteAdmin().auth.admin.createUser({
    email: p.email,
    password: p.pin,
    email_confirm: true,
    user_metadata: {
      tenant_id: p.tenantId,
      dni: p.dni,
      nombre: p.nombre,
      rol: p.rol,
      telefono: p.telefono,
    },
  });
}

export async function reemplazarPin(id: string, pinNuevo: string) {
  return clienteAdmin().auth.admin.updateUserById(id, { password: pinNuevo });
}

/** Con el cliente normal: el RLS confirma que la persona es del mismo hostal. */
export async function actualizar(id: string, valores: object) {
  const supabase = await clienteServidor();
  return supabase.from('profiles').update(valores).eq('id', id);
}

export async function buscarEnMiHostal(id: string, tenantId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
}

export async function turnoAbiertoDe(usuarioId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('turnos')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('estado', 'abierto')
    .maybeSingle();
}

export async function fijarActivo(id: string, activo: boolean) {
  const supabase = await clienteServidor();
  return supabase.from('profiles').update({ activo }).eq('id', id);
}

/** El PIN lo puso otra persona: la app obligará a cambiarlo. Va con admin porque el
 *  perfil lo acaba de crear un trigger y puede no ser visible aún por RLS. */
export async function marcarPinTemporal(id: string) {
  return clienteAdmin().from('profiles').update({ pin_temporal: true }).eq('id', id);
}
