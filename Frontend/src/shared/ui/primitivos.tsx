import type { ReactNode } from 'react';

/** Componentes base Atlas. Un primario por sección; estado antes que descripción. */

export function Card({
  children,
  className = '',
  padding = 'p-4',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return <div className={`card rounded-xl bg-surf hair ${padding} ${className}`}>{children}</div>;
}

type Tono = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'muted';

const TONO: Record<Tono, { color: string; fondo: string }> = {
  success: { color: '#22C55E', fondo: 'rgba(34,197,94,.14)' },
  warning: { color: '#F59E0B', fondo: 'rgba(245,158,11,.14)' },
  danger: { color: '#EF4444', fondo: 'rgba(239,68,68,.14)' },
  info: { color: '#3B82F6', fondo: 'rgba(59,130,246,.14)' },
  brand: { color: '#7C4DFF', fondo: 'rgba(124,77,255,.12)' },
  muted: { color: '#A8ADB3', fondo: 'rgba(168,173,179,.12)' },
};

export function Chip({
  children,
  tono = 'muted',
  icono,
}: {
  children: ReactNode;
  tono?: Tono;
  icono?: ReactNode;
}) {
  const t = TONO[tono];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap"
      style={{ color: t.color, background: t.fondo }}
    >
      {icono}
      {children}
    </span>
  );
}

export function Boton({
  children,
  variante = 'secundario',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variante?: 'primario' | 'secundario' | 'fantasma' | 'peligro';
}) {
  const estilos = {
    primario: 'md-raise bg-brand-500 text-onbrand hover:bg-brand-600 active:bg-brand-700',
    secundario: 'bg-surf hair text-tx hover:bg-surf-hover',
    fantasma: 'text-tx-sec hover:text-tx hover:bg-surf-hover',
    peligro: 'hair text-danger hover:bg-surf-hover',
  }[variante];

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}

export function Campo({
  etiqueta,
  error,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta?: string; error?: string }) {
  return (
    <label className="block">
      {etiqueta && (
        <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">{etiqueta}</span>
      )}
      <input
        {...props}
        className={`w-full rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx placeholder:text-tx-dis transition-colors focus:border-brand-500 ${className}`}
      />
      {error && <span className="mt-1 block text-[12px] text-danger">{error}</span>}
    </label>
  );
}

/** Píldora de filtro. La activa va en alto contraste, no solo con color. */
export function Pildora({
  activa,
  children,
  onClick,
}: {
  activa: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activa}
      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
        activa ? '' : 'bg-surf hair text-tx-sec hover:text-tx hover:bg-surf-hover'
      }`}
      style={activa ? { background: 'var(--tx)', color: 'var(--canvas)' } : undefined}
    >
      {children}
    </button>
  );
}

/** Los cuatro estados obligatorios de los docs Atlas: cargando, vacío, error, con datos. */
export function Esqueleto({ alto = 'h-24' }: { alto?: string }) {
  return <div className={`sk rounded-xl ${alto}`} />;
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="rounded-xl bg-surf hair px-6 py-10 text-center">
      <p className="text-[15px] font-medium text-tx-sec">{titulo}</p>
      {detalle && <p className="mt-1 text-[13px] text-tx-muted">{detalle}</p>}
    </div>
  );
}

export function ErrorCaja({ mensaje }: { mensaje: string }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-[13px]"
      style={{ background: 'rgba(239,68,68,.12)', color: '#EF4444' }}
      role="alert"
    >
      {mensaje}
    </div>
  );
}

/** Soles, como manda CLAUDE.md. */
export function soles(monto: number): string {
  return `S/ ${Number(monto).toFixed(2)}`;
}
