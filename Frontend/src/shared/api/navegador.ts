import { ejecutar, type Opciones, type Resultado } from './contrato';

/** Llamada desde el navegador. El rewrite de next.config la lleva al backend, mismo origen. */
export async function pedirCliente<T>(ruta: string, opciones: Opciones = {}): Promise<Resultado<T>> {
  return ejecutar<T>(ruta, opciones);
}
