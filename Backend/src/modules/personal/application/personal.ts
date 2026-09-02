'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirRol, ROLES_ADMIN } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { Perfil } from '../domain/tipos';
import { PersonaSchema, ActualizarPersonaSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

/**
 * Único módulo que usa `service_role`, y solo porque crear un usuario de Auth exige la Admin API.
 * Como esa clave se salta el RLS, cada función verifica rol y hostal a mano antes de tocar nada.
 * El PIN nunca se guarda en `profiles`: vive cifrado en Supabase Auth.
 */

export async function listarPersonal(): Promise<Resultado<Perfil[]>> {
  await exigirRol(...ROLES_ADMIN);

  const { data, error } = await repo.buscarPersonal();
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as Perfil[]);
}

export async function crearPersona(
  entrada: z.input<typeof PersonaSchema>
): Promise<Resultado<{ id: string; dni: string }>> {
  const parsed = PersonaSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  // Verificación explícita: abajo se usa una clave que ignora el RLS.
  const sesion = await exigirRol(...ROLES_ADMIN);

  const { data: tenant } = await repo.slugDelHostal(sesion.tenantId);
  if (!tenant) return fallo('No se pudo identificar el hostal.');

  const { data: email } = await repo.emailDeDni(parsed.data.dni, tenant.slug);

  // El tenant_id sale de la SESIÓN, nunca del formulario.
  const { data: creado, error } = await repo.crearUsuario({
    email: email as string,
    pin: parsed.data.pin,
    tenantId: sesion.tenantId,
    dni: parsed.data.dni,
    nombre: parsed.data.nombre,
    rol: parsed.data.rol,
    telefono: parsed.data.telefono || null,
  });

  if (error) {
    if (error.message?.includes('already been registered')) {
      return fallo('Ya hay alguien registrado con ese DNI.', 'dni');
    }
    if (error.message?.toLowerCase().includes('password')) {
      return fallo(
        'El PIN es más corto de lo que permite Supabase. Sube el mínimo en ' +
          'Authentication > Providers > Email, o usa un PIN de 6 dígitos.',
        'pin'
      );
    }
    return fallo(traducirError(error));
  }

  // El trigger `auth_crear_profile` ya creó el perfil y metió tenant_id y rol en el JWT.
  // El PIN lo eligió quien da de alta, no la persona: se marca temporal para que la app
  // le obligue a cambiarlo en el primer ingreso (migración 14).
  await repo.marcarPinTemporal(creado.user!.id);

  revalidatePath('/admin/personal');
  return exito({ id: creado.user!.id, dni: parsed.data.dni });
}

export async function actualizarPersona(
  id: string,
  entrada: z.input<typeof ActualizarPersonaSchema>
): Promise<Resultado<null>> {
  const parsed = ActualizarPersonaSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  const sesion = await exigirRol(...ROLES_ADMIN);

  if (id === sesion.usuarioId && parsed.data.rol !== 'administrador') {
    return fallo('No puedes quitarte a ti mismo el rol de administrador.', 'rol');
  }

  const { error } = await repo.actualizar(id, {
    nombre: parsed.data.nombre,
    rol: parsed.data.rol,
    telefono: parsed.data.telefono || null,
  });
  if (error) return fallo(traducirError(error));

  revalidatePath('/admin/personal');
  return exito(null);
}

/** Reset de PIN. El administrador lo reemplaza, nunca lo lee. */
export async function reiniciarPin(id: string, pinNuevo: string): Promise<Resultado<null>> {
  if (!/^[0-9]{4,64}$/.test(pinNuevo)) {
    return fallo('El PIN debe tener al menos 4 dígitos y solo números.', 'pin');
  }

  const sesion = await exigirRol(...ROLES_ADMIN);

  // Comprobación a mano: el RLS no protege al cliente admin de abajo.
  const { data: destino } = await repo.buscarEnMiHostal(id, sesion.tenantId);
  if (!destino) return fallo('Esa persona no pertenece a tu hostal.');

  const { error } = await repo.reemplazarPin(id, pinNuevo);
  if (error) return fallo(traducirError(error));

  // Lo eligió el administrador, así que la persona tendrá que cambiarlo al entrar.
  await repo.marcarPinTemporal(id);

  revalidatePath('/admin/personal');
  return exito(null);
}

/** Baja lógica: hay turnos, ventas y auditoría firmados por esta persona. */
export async function desactivarPersona(id: string): Promise<Resultado<null>> {
  const sesion = await exigirRol(...ROLES_ADMIN);

  if (id === sesion.usuarioId) return fallo('No puedes desactivar tu propia cuenta.');

  const { data: turnoAbierto } = await repo.turnoAbiertoDe(id);
  if (turnoAbierto) {
    return fallo('Esa persona tiene un turno abierto. Ciérralo antes de darla de baja.');
  }

  const { error } = await repo.fijarActivo(id, false);
  if (error) return fallo(traducirError(error));

  revalidatePath('/admin/personal');
  return exito(null);
}

export async function reactivarPersona(id: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_ADMIN);

  const { error } = await repo.fijarActivo(id, true);
  if (error) return fallo(traducirError(error));

  revalidatePath('/admin/personal');
  return exito(null);
}
