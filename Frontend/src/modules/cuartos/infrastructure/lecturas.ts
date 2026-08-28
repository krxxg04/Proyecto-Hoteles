import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { CuartoConTipo, TipoCuarto } from '../domain/tipos';

/** Lecturas desde Server Components. */
export async function listarCuartos(): Promise<Resultado<CuartoConTipo[]>> {
  return pedir<CuartoConTipo[]>('/api/cuartos');
}

export async function listarTiposCuarto(): Promise<Resultado<TipoCuarto[]>> {
  return pedir<TipoCuarto[]>('/api/cuartos?tipos=1');
}
