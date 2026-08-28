import { Esqueleto } from './primitivos';

/**
 * Esqueletos de carga. Los cuatro estados de Atlas son cargando, vacío, error y con
 * datos; hasta ahora faltaba el primero y las páginas se quedaban en blanco.
 *
 * La forma imita la del contenido real para que no salte el diseño al llegar los datos.
 */
export function Cargando({
  forma = 'lista',
  filas = 6,
}: {
  forma?: 'lista' | 'rejilla' | 'panel' | 'formulario';
  filas?: number;
}) {
  if (forma === 'rejilla') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Esqueleto key={i} alto="h-8 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: filas * 2 }, (_, i) => (
            <Esqueleto key={i} alto="h-[92px]" />
          ))}
        </div>
      </div>
    );
  }

  if (forma === 'panel') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
        <Esqueleto alto="h-16" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Esqueleto key={i} alto="h-[88px]" />
          ))}
        </div>
        <Esqueleto alto="h-64" />
      </div>
    );
  }

  if (forma === 'formulario') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3" aria-busy="true" aria-label="Cargando">
        <Esqueleto alto="h-8" />
        {Array.from({ length: filas }, (_, i) => (
          <Esqueleto key={i} alto="h-11" />
        ))}
        <Esqueleto alto="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando">
      <Esqueleto alto="h-9 w-56" />
      {Array.from({ length: filas }, (_, i) => (
        <Esqueleto key={i} alto="h-14" />
      ))}
    </div>
  );
}
