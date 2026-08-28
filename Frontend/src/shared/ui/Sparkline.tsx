/**
 * Minigráfica de una serie corta. SVG a pelo: una librería de gráficas para catorce
 * puntos serían 40 KB en la tablet de recepción.
 *
 * Si la serie está vacía o es toda ceros no se pinta nada. El mockup dibujaba una línea
 * bonita siempre; una gráfica sin datos detrás no informa, decora.
 */
export function Sparkline({
  serie,
  color = '#7C4DFF',
  ancho = 88,
  alto = 26,
}: {
  serie: number[];
  color?: string;
  ancho?: number;
  alto?: number;
}) {
  if (serie.length < 2 || serie.every((v) => v === 0)) return null;

  const max = Math.max(...serie);
  const min = Math.min(...serie);
  const rango = max - min || 1;

  const puntos = serie.map((v, i) => {
    const x = (i / (serie.length - 1)) * ancho;
    // El SVG crece hacia abajo: se invierte para que más valor quede más arriba.
    const y = alto - ((v - min) / rango) * (alto - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        points={puntos.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Barra de proporción para las listas de «Consumo del hostal».
 * El ancho es relativo al mayor de la lista, no a un máximo absoluto.
 */
export function BarraProporcion({ valor, maximo }: { valor: number; maximo: number }) {
  const porcentaje = maximo > 0 ? Math.max(4, Math.round((valor / maximo) * 100)) : 0;
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-ter">
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${porcentaje}%` }}
      />
    </div>
  );
}
