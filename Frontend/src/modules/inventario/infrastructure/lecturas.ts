import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { PendienteAseo, Producto } from '../domain/tipos';

export async function listarProductos(soloVendibles = false): Promise<Resultado<Producto[]>> {
  return pedir<Producto[]>(`/api/productos${soloVendibles ? '?vendibles=1' : ''}`);
}

export async function listarAseoPendiente(): Promise<Resultado<PendienteAseo[]>> {
  return pedir<PendienteAseo[]>('/api/aseo');
}
