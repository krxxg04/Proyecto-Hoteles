import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { Perfil } from '../domain/tipos';

export async function listarPersonal(): Promise<Resultado<Perfil[]>> {
  return pedir<Perfil[]>('/api/personal');
}
