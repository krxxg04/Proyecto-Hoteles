import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { Huesped } from '../domain/tipos';

export async function listarHuespedes(busqueda?: string): Promise<Resultado<Huesped[]>> {
  const q = busqueda?.trim() ? `?q=${encodeURIComponent(busqueda.trim())}` : '';
  return pedir<Huesped[]>(`/api/huespedes${q}`);
}
