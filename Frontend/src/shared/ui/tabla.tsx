import type { ReactNode } from 'react';

/** Tabla de administración, portada de `adminTable()` del mockup. */
export function Tabla({
  columnas,
  children,
  vacio = 'Sin registros todavía.',
}: {
  columnas: string[];
  children: ReactNode;
  vacio?: string;
}) {
  const hayFilas = Array.isArray(children) ? children.length > 0 : !!children;

  return (
    <div className="overflow-hidden rounded-lg bg-surf hair">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="hair-b text-left text-[12px] text-tx-muted">
              {columnas.map((c, i) => (
                <th key={i} className={`px-4 py-2.5 font-medium ${c === '' ? 'text-right' : ''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hayFilas ? (
              children
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-tx-muted" colSpan={columnas.length}>
                  {vacio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Fila({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`hair-b transition-colors last:border-0 hover:bg-surf-hover ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {children}
    </tr>
  );
}

export function Celda({
  children,
  className = '',
  oculta,
}: {
  children: ReactNode;
  className?: string;
  /** Se esconde en pantallas chicas, como en el mockup. */
  oculta?: 'sm' | 'md';
}) {
  const esconder = oculta === 'sm' ? 'hidden sm:table-cell' : oculta === 'md' ? 'hidden md:table-cell' : '';
  return <td className={`px-4 py-3 ${esconder} ${className}`}>{children}</td>;
}

/** Encabezado de sección con acción primaria a la derecha. Un primario por sección. */
export function EncabezadoSeccion({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div>
        <h2 className="text-[18px] font-semibold">{titulo}</h2>
        {subtitulo && <p className="text-[13px] text-tx-muted">{subtitulo}</p>}
      </div>
      {accion && <div className="ml-auto flex items-center gap-2">{accion}</div>}
    </div>
  );
}
