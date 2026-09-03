import Link from 'next/link';
import {
  BedDouble,
  LogIn,
  LogOut,
  Package,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type { ResumenPanel } from '../domain/tipos';
import type { CuartoConTipo } from '@/modules/cuartos/domain/tipos';
import { Card, Chip, soles } from '@/shared/ui/primitivos';
import { Sparkline, BarraProporcion } from '@/shared/ui/Sparkline';
import { ESTILO_ESTADO } from '@/modules/cuartos/ui/estados';

/**
 * Panel de inicio. Portado del dashboard del mockup, sin lo premium.
 *
 * Fuera quedan, a propósito: la alerta de «activo fuera de zona» (es RFID, núcleo del
 * plan Premium según `plan.md`) y la corona de Premium.
 */

function StatCard({
  titulo,
  valor,
  sufijo,
  pie,
  icono,
  serie,
  color,
  tendencia,
}: {
  titulo: string;
  valor: string;
  sufijo?: string;
  pie?: string;
  icono: React.ReactNode;
  serie?: number[];
  color?: string;
  tendencia?: 'sube' | 'baja';
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-tx-muted">{titulo}</p>
        <span className="text-tx-muted">{icono}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums">
          {valor}
          {sufijo && <span className="ml-1 text-[14px] font-medium text-tx-muted">{sufijo}</span>}
        </p>
        {serie && <Sparkline serie={serie} color={color} />}
      </div>

      {pie && (
        <p className="mt-1.5 flex items-center gap-1 text-[12px] text-tx-muted">
          {tendencia === 'sube' && <TrendingUp className="size-3.5 text-success" />}
          {tendencia === 'baja' && <TrendingDown className="size-3.5 text-danger" />}
          {pie}
        </p>
      )}
    </Card>
  );
}

/** Una de las dos listas de «Consumo del hostal». */
function ListaConsumo({
  titulo,
  icono,
  lineas,
  vacio,
}: {
  titulo: string;
  icono: React.ReactNode;
  lineas: Array<{ nombre: string; cantidad: number; unidad?: string }>;
  vacio: string;
}) {
  const maximo = Math.max(...lineas.map((l) => l.cantidad), 0);

  return (
    <div className="rounded-lg bg-bg-ter hair p-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold">
        <span className="text-brand-500">{icono}</span>
        {titulo}
      </p>

      {lineas.length === 0 ? (
        <p className="py-3 text-[12.5px] text-tx-muted">{vacio}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {lineas.map((l) => (
            <div key={l.nombre}>
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate">{l.nombre}</span>
                <span className="shrink-0 tabular-nums text-tx-sec">
                  {l.cantidad}
                  {l.unidad ? ` ${l.unidad}` : ''}
                </span>
              </div>
              <BarraProporcion valor={l.cantidad} maximo={maximo} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * El resumen narrativo del día.
 *
 * El mockup lo etiquetaba «Resumen de IA · alta confianza». Este lo arman reglas sobre
 * los datos del turno, sin llamar a ningún modelo — así que llamarlo IA sería mentir en
 * la propia pantalla. Dice lo mismo y no cuesta un céntimo.
 */
function ResumenDelDia({ resumen }: { resumen: ResumenPanel }) {
  const partes: React.ReactNode[] = [];

  if (resumen.checkoutsHoy > 0) {
    partes.push(
      <strong key="co" className="font-semibold text-tx">
        {resumen.checkoutsHoy} check-out{resumen.checkoutsHoy === 1 ? '' : 's'}
      </strong>
    );
  }
  if (resumen.checkinsHoy > 0) {
    partes.push(
      <strong key="ci" className="font-semibold text-tx">
        {resumen.checkinsHoy} check-in{resumen.checkinsHoy === 1 ? '' : 's'}
      </strong>
    );
  }
  if (resumen.cuartos.porLimpiar > 0) {
    partes.push(
      <strong key="pl" className="font-semibold text-tx">
        {resumen.cuartos.porLimpiar} habitacion{resumen.cuartos.porLimpiar === 1 ? '' : 'es'} por
        preparar
      </strong>
    );
  }

  return (
    <Card padding="p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/15">
          <Sparkles className="size-[18px] text-brand-500" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Resumen del día</p>

          <p className="mt-1 text-[13.5px] leading-relaxed text-tx-sec">
            {partes.length === 0 ? (
              'No hay movimiento registrado hoy.'
            ) : (
              <>
                Hoy hay{' '}
                {partes.map((p, i) => (
                  <span key={i}>
                    {p}
                    {i < partes.length - 2 ? ', ' : i === partes.length - 2 ? ' y ' : ''}
                  </span>
                ))}
                .
              </>
            )}
            {resumen.porAcabarse && (
              <>
                {' '}
                <span className="text-tx-sec">
                  {resumen.porAcabarse.nombre}{' '}
                  {resumen.porAcabarse.dias !== null ? (
                    <>
                      da para{' '}
                      <strong
                        className={`font-semibold ${
                          resumen.porAcabarse.dias <= 7 ? 'text-warning' : 'text-tx'
                        }`}
                      >
                        ~{resumen.porAcabarse.dias} día{resumen.porAcabarse.dias === 1 ? '' : 's'}
                      </strong>
                    </>
                  ) : (
                    <>
                      está al{' '}
                      <strong
                        className={`font-semibold ${
                          resumen.porAcabarse.nivel < 25 ? 'text-warning' : 'text-tx'
                        }`}
                      >
                        {resumen.porAcabarse.nivel} %
                      </strong>
                    </>
                  )}
                  .
                </span>
              </>
            )}
            {resumen.incidenciasAbiertas > 0 && (
              <>
                {' '}
                <Link href="/alertas" className="text-warning underline underline-offset-2">
                  {resumen.incidenciasAbiertas} incidencia
                  {resumen.incidenciasAbiertas === 1 ? '' : 's'} sin revisar
                </Link>
                .
              </>
            )}
          </p>

          <p className="mt-2 text-[11.5px] text-tx-muted">
            Calculado con los datos del hostal, no con un modelo de lenguaje.
          </p>
        </div>
      </div>
    </Card>
  );
}

export function Panel({
  resumen,
  cuartos,
  nombre,
}: {
  resumen: ResumenPanel;
  cuartos: CuartoConTipo[];
  nombre: string;
}) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  const variacion = resumen.ingresosHoy - resumen.ingresosAyer;

  /** Lo que hay que atender primero; si no hay nada pendiente, las primeras por número. */
  const destacados = [...cuartos]
    .sort((a, b) => {
      const urgente = (e: string) => (['inspeccion', 'limpieza'].includes(e) ? 0 : 1);
      return urgente(a.estado) - urgente(b.estado) || a.numero.localeCompare(b.numero);
    })
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight">
          {saludo}, {nombre.split(' ')[0] || 'hola'}
        </h2>
        <p className="mt-0.5 text-[13.5px] text-tx-sec">
          {resumen.cuartos.ocupados} de {resumen.cuartos.total} habitaciones ocupadas ·{' '}
          {resumen.cuartos.porLimpiar > 0
            ? `${resumen.cuartos.porLimpiar} por preparar`
            : 'todo al día'}
        </p>
      </div>

      <ResumenDelDia resumen={resumen} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          titulo="Check-outs hoy"
          valor={String(resumen.checkoutsHoy)}
          icono={<LogOut className="size-[18px]" />}
          serie={resumen.series.checkouts}
          color="#EF4444"
        />
        <StatCard
          titulo="Check-ins hoy"
          valor={String(resumen.checkinsHoy)}
          icono={<LogIn className="size-[18px]" />}
          serie={resumen.series.checkins}
          color="#3B82F6"
        />
        <StatCard
          titulo="Habitaciones listas"
          valor={String(resumen.cuartos.disponibles)}
          sufijo={`de ${resumen.cuartos.total}`}
          pie={`${resumen.ocupacion}% de ocupación`}
          icono={<BedDouble className="size-[18px]" />}
        />
        <StatCard
          titulo="Ventas de hoy"
          valor={soles(resumen.ingresosHoy)}
          pie={
            resumen.ingresosAyer > 0
              ? `${variacion >= 0 ? '+' : ''}${soles(variacion)} vs ayer`
              : 'sin comparativa'
          }
          tendencia={variacion >= 0 ? 'sube' : 'baja'}
          icono={<Wallet className="size-[18px]" />}
          serie={resumen.series.ventas}
          color="#22C55E"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Consumo del hostal */}
        <Card padding="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold">Consumo del hostal</h3>
            <span className="text-[12px] text-tx-muted">14 días</span>
          </div>

          <div className="flex flex-col gap-3">
            <ListaConsumo
              titulo="Productos más consumidos"
              icono={<Package className="size-3.5" />}
              lineas={resumen.consumo.productos}
              vacio="Nada ha salido del almacén todavía."
            />
            <ListaConsumo
              titulo="Tipo de cuarto más frecuente"
              icono={<BedDouble className="size-3.5" />}
              lineas={resumen.consumo.tipos}
              vacio="Sin estadías registradas."
            />
          </div>

          {resumen.stockCritico > 0 && (
            <Link
              href="/inventario"
              className="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] text-warning bg-warning/10"
            >
              <TriangleAlert className="size-4 shrink-0" />
              {resumen.stockCritico} producto{resumen.stockCritico === 1 ? '' : 's'} por debajo del
              25 %
            </Link>
          )}
        </Card>

        {/* Mapa de habitaciones */}
        <Card padding="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-[15px] font-semibold">Mapa de habitaciones</h3>
            <div className="ml-auto flex items-center gap-2.5">
              {(['lista', 'limpieza', 'inspeccion'] as const).map((e) => (
                <span key={e} className="flex items-center gap-1 text-[11.5px] text-tx-muted">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: ESTILO_ESTADO[e].color }}
                  />
                  {ESTILO_ESTADO[e].etiqueta}
                </span>
              ))}
              <Link href="/habitaciones" className="text-[12.5px] text-tx-sec hover:text-tx">
                Ver todas
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {destacados.map((c) => {
              const e = ESTILO_ESTADO[c.estado];
              return (
                <Link
                  key={c.id}
                  href="/habitaciones"
                  className="card relative overflow-hidden rounded-xl bg-surf hair p-3 transition-transform hover:-translate-y-0.5 hover:bg-surf-hover"
                >
                  <span
                    className="absolute left-0 top-0 h-full w-1.5"
                    style={{ background: e.color }}
                  />
                  <div className="flex items-center justify-between gap-2 pl-1.5">
                    <p className="text-[19px] font-bold leading-none tracking-tight">{c.numero}</p>
                    <Chip tono="muted">
                      <span style={{ color: e.color }}>{e.etiqueta}</span>
                    </Chip>
                  </div>
                  <p className="mt-1.5 pl-1.5 text-[11.5px] text-tx-muted">{c.tipo}</p>
                  <p className="mt-0.5 truncate pl-1.5 text-[12px] text-tx-sec">
                    {c.nota || `Aforo ${c.aforo}`}
                  </p>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
