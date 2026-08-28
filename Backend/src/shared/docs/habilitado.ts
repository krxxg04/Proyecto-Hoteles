/** Swagger solo fuera de producción. Para abrirlo en un despliegue: `HABILITAR_DOCS=1`. */
export function docsHabilitados(): boolean {
  if (process.env.HABILITAR_DOCS === '1') return true;
  return process.env.NODE_ENV !== 'production';
}
