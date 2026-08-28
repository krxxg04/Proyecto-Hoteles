'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { exigirSesion, exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import { PermisoSubidaSchema } from '../domain/esquemas';
import {
  EXIGE_CONSENTIMIENTO,
  RETENCION_DIAS,
  type Medio,
  type PermisoDeSubida,
  type TipoMedio,
} from '../domain/tipos';
import * as repo from '../infrastructure/repositorio';
import { BUCKET, SEGUNDOS_LECTURA, SEGUNDOS_SUBIDA, borrarObjeto, r2Configurado, urlDeLectura, urlDeSubida } from '../infrastructure/r2';

/**
 * Fotos en Cloudflare R2, bucket privado y URLs firmadas (ADR-001 §4, gate #3).
 *
 * El archivo NO pasa por el backend: el servidor firma un permiso de subida corto y el
 * navegador sube directo a R2. Así no se paga tránsito ni se ocupa memoria del servidor
 * con imágenes, y la clave de R2 nunca sale de aquí.
 *
 * ⚠️ ESTE CAMINO NO SE HA EJECUTADO NUNCA contra un bucket real: no hay cuenta de R2
 * configurada todavía. Compila y pasa tipos; `GET /api/salud` dice si hay credenciales.
 */

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
};

function fechaDeRetencion(tipo: TipoMedio): string | null {
  const dias = RETENCION_DIAS[tipo];
  if (dias === null) return null;
  return new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString();
}

/**
 * Permiso para subir una foto.
 *
 * La llave empieza por el `tenant_id` a propósito: aunque una llave se filtre, deja
 * claro de quién es y hace imposible acertar la de otro hostal por casualidad.
 */
export async function permisoDeSubida(
  entrada: z.input<typeof PermisoSubidaSchema>
): Promise<Resultado<PermisoDeSubida>> {
  const parsed = PermisoSubidaSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0] ?? ''));
  }

  const sesion = await exigirSesion();
  const d = parsed.data;

  if (!r2Configurado()) {
    return fallo('El almacenamiento de fotos no está configurado todavía. Avisa al administrador.');
  }

  // Datos sensibles: sin consentimiento registrado no se sube nada (Ley 29733).
  if (EXIGE_CONSENTIMIENTO.includes(d.tipo)) {
    const finalidad = `Fotografía de ${d.tipo} para verificación de identidad`;
    const { data: previo } = await repo.consentimientoVigente(d.huesped_id!, finalidad);

    if (!previo) {
      if (!d.consentimiento) {
        return fallo(
          'Falta el consentimiento del huésped para guardar esa foto. Pídeselo y anota cómo lo dio.',
          'consentimiento'
        );
      }
      const { error } = await repo.registrarConsentimiento({
        tenant_id: sesion.tenantId,
        huesped_id: d.huesped_id!,
        finalidad,
        evidencia: d.consentimiento,
      });
      if (error) return fallo(traducirError(error));
    }
  }

  const objectKey = `${sesion.tenantId}/${d.tipo}/${randomUUID()}.${EXTENSION[d.mime]}`;

  const { data: medio, error } = await repo.registrar({
    tenant_id: sesion.tenantId,
    bucket: BUCKET,
    object_key: objectKey,
    mime: d.mime,
    bytes: d.bytes,
    tipo: d.tipo,
    huesped_id: d.huesped_id ?? null,
    estadia_id: d.estadia_id ?? null,
    retener_hasta: fechaDeRetencion(d.tipo),
    subido_por: sesion.usuarioId,
  });

  if (error) return fallo(traducirError(error));

  const url = await urlDeSubida(objectKey, d.mime, d.bytes);

  return exito({
    medio_id: (medio as Medio).id,
    url,
    metodo: 'PUT',
    // Tienen que coincidir con lo firmado o R2 rechaza la subida.
    cabeceras: { 'Content-Type': d.mime },
    expira_en_segundos: SEGUNDOS_SUBIDA,
  });
}

/** URL firmada para ver una foto. Caduca en minutos: no sirve para compartir por fuera. */
export async function urlFirmada(
  id: string
): Promise<Resultado<{ url: string; expira_en_segundos: number; tipo: string }>> {
  await exigirSesion();

  if (!r2Configurado()) return fallo('El almacenamiento de fotos no está configurado todavía.');

  // El RLS hace el trabajo: si el medio es de otro hostal, aquí no llega nada que firmar.
  const { data, error } = await repo.buscarMedio(id);
  if (error) return fallo(traducirError(error));

  const medio = data as Medio;
  const url = await urlDeLectura(medio.object_key);

  return exito({ url, expira_en_segundos: SEGUNDOS_LECTURA, tipo: medio.tipo });
}

export async function listarMediosDe(
  columna: 'huesped_id' | 'estadia_id',
  valor: string
): Promise<Resultado<Medio[]>> {
  await exigirSesion();

  const { data, error } = await repo.listarDe(columna, valor);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as Medio[]);
}

/**
 * Borrado de verdad: primero el objeto en R2, después la fila.
 *
 * En ese orden a propósito. Si falla el segundo paso queda una fila que apunta a nada,
 * que es un fallo visible y arreglable; al revés quedaría un archivo huérfano en el
 * bucket que nadie sabe que existe — justo lo que la Ley 29733 no perdona.
 */
export async function borrarMedio(id: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarMedio(id);
  if (error) return fallo(traducirError(error));

  try {
    await borrarObjeto((data as Medio).object_key);
  } catch (e) {
    return fallo(e instanceof Error ? e.message : 'No se pudo borrar el archivo.');
  }

  const { error: errorFila } = await repo.borrarFila(id);
  if (errorFila) return fallo(traducirError(errorFila));

  return exito(null);
}
