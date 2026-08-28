import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { Catalogos, EstadiaActiva, Inspeccion, PlantillaInspeccion } from '../domain/tipos';

/** Lecturas desde Server Components. */

export async function estadiasActivas(): Promise<Resultado<EstadiaActiva[]>> {
  return pedir<EstadiaActiva[]>('/api/checkin');
}

export async function catalogos(): Promise<Resultado<Catalogos>> {
  return pedir<Catalogos>('/api/catalogos');
}

export async function plantillaInspeccion(cuartoId: string): Promise<Resultado<PlantillaInspeccion>> {
  return pedir<PlantillaInspeccion>(`/api/inspecciones?plantilla=1&cuarto_id=${cuartoId}`);
}

export async function historialInspecciones(): Promise<Resultado<Inspeccion[]>> {
  return pedir<Inspeccion[]>('/api/inspecciones');
}
