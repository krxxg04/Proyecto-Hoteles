import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { ResumenPanel } from '../domain/tipos';

export async function resumenPanel(): Promise<Resultado<ResumenPanel>> {
  return pedir<ResumenPanel>('/api/panel');
}
