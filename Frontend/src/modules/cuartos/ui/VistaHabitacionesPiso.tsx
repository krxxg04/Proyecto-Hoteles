'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BrushCleaning, CheckCheck, ClipboardList, Wrench } from 'lucide-react';
import type { CuartoConTipo, EstadoCuarto } from '../domain/tipos';
import { cambiarEstadoCuarto } from '../infrastructure/acciones';
import { ESTILO_ESTADO } from './estados';
import { ORDEN_TRABAJO, SIGUIENTE_PASO, ordenarPorTrabajo } from './flujo';
import { Boton, Chip, ErrorCaja } from '@/shared/ui/primitivos';
import { useEnVivo } from '@/shared/ui/useEnVivo';
import { PuntoEnVivo } from '@/shared/ui/PuntoEnVivo';

/**
 * Habitaciones para quien trabaja el piso: limpieza y mantenimiento.
 *
 * `plan.md` línea 42: «vista simplificada para limpieza (solo su lista de cuartos)».
 *
 * La diferencia con la vista de recepción no es que aquí se vea menos, es que aquí se
 * decide menos. Recepción elige entre siete estados porque tiene que poder corregir
 * cualquier cosa; quien está limpiando con una tablet en la mano no elige: termina un
 * cuarto y pasa al siguiente paso. Un solo botón grande, y el que toca.
 *
 * Los estados `libre`, `ocupada` y `checkout` ni se ofrecen: van con el check-in y el
 * cobro, y desde `08_acciones_por_rol.sql` la base los rechaza para estos roles.
 */

/** Lo que sí puede hacer este rol fuera del flujo: avisar de una avería. */
const AVERIA: EstadoCuarto = 'mantenimiento';

function TarjetaTrabajo({
  cuarto,
  ocupado,
  onAvanzar,
  onAveria,
}: {
  cuarto: CuartoConTipo;
  ocupado: boolean;
  onAvanzar: (c: CuartoConTipo, estado: EstadoCuarto) => void;
  onAveria: (c: CuartoConTipo) => void;
}) {
  const e = ESTILO_ESTADO[cuarto.estado];
  const paso = SIGUIENTE_PASO[cuarto.estado];

  return (
    <div className="card relative overflow-hidden rounded-xl bg-surf hair p-4">
      <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: e.color }} />

      <div className="mb-1 flex items-center justify-between gap-2 pl-1.5">
        <span className="text-[26px] font-bold leading-none tracking-tight">{cuarto.numero}</span>
        <Chip tono="muted">
          <span style={{ color: e.color }}>{e.etiqueta}</span>
        </Chip>
      </div>

      <p className="pl-1.5 text-[12px] text-tx-muted">{cuarto.tipo}</p>
      {cuarto.nota && (
        <p className="mt-1 line-clamp-2 pl-1.5 text-[13px] text-tx-sec">{cuarto.nota}</p>
      )}

      {paso && (
        <Boton
          variante="primario"
          disabled={ocupado}
          onClick={() => onAvanzar(cuarto, paso.estado)}
          /* Alto de 44 px: se pulsa con el pulgar y con guantes puestos. */
          className="mt-3 h-11 w-full"
        >
          {paso.estado === 'limpieza' && <BrushCleaning className="size-4" />}
          {paso.estado === 'inspeccion' && <ClipboardList className="size-4" />}
          {paso.estado === 'lista' && <CheckCheck className="size-4" />}
          {paso.verbo}
        </Boton>
      )}

      {cuarto.estado !== AVERIA && (
        <Boton
          variante="fantasma"
          disabled={ocupado}
          onClick={() => onAveria(cuarto)}
          className="mt-1.5 w-full"
        >
          <Wrench className="size-3.5" />
          Reportar avería
        </Boton>
      )}
    </div>
  );
}

export function VistaHabitacionesPiso({ cuartos }: { cuartos: CuartoConTipo[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const enVivo = useEnVivo('cuartos');

  /** Lo que le toca a este rol. El orden es el del flujo, no el del número. */
  const mios = ordenarPorTrabajo(cuartos.filter((c) => ORDEN_TRABAJO.includes(c.estado)));

  /** El resto, solo para mirar: ocupadas, libres y las que ya están listas. */
  const resto = cuartos.filter((c) => !ORDEN_TRABAJO.includes(c.estado));

  function cambiar(cuarto: CuartoConTipo, estado: EstadoCuarto) {
    setError(null);
    empezar(async () => {
      const r = await cambiarEstadoCuarto({ cuarto_id: cuarto.id, estado });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-tx-muted">
          Tu lista · {mios.length} por atender
        </p>
        <span className="ml-auto">
          <PuntoEnVivo estado={enVivo} />
        </span>
      </div>

      {error && <ErrorCaja mensaje={error} />}

      {mios.length === 0 ? (
        <div className="rounded-xl bg-surf hair px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-tx-sec">No queda nada por atender</p>
          <p className="mt-1 text-[13px] text-tx-muted">
            Cuando recepción registre una salida, la habitación aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mios.map((c) => (
            <TarjetaTrabajo
              key={c.id}
              cuarto={c}
              ocupado={ocupado}
              onAvanzar={cambiar}
              onAveria={(x) => cambiar(x, AVERIA)}
            />
          ))}
        </div>
      )}

      {resto.length > 0 && (
        <details className="rounded-xl bg-surf hair px-4 py-3">
          <summary className="cursor-pointer text-[13px] text-tx-sec">
            El resto del hostal ({resto.length}) · solo para ver
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {resto.map((c) => {
              const e = ESTILO_ESTADO[c.estado];
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-bg-ter hair px-2.5 py-1.5 text-[13px]"
                >
                  <span className="size-2 rounded-full" style={{ background: e.color }} />
                  <span className="font-medium">{c.numero}</span>
                  <span className="text-tx-muted">{e.etiqueta}</span>
                </span>
              );
            })}
          </div>
          <p className="mt-2.5 text-[11.5px] text-tx-muted">
            Esas las mueve recepción: van con el check-in y el cobro.
          </p>
        </details>
      )}
    </div>
  );
}
