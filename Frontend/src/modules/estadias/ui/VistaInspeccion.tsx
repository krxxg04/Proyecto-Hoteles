'use client';

import { useRouter } from 'next/navigation';
import { Card, Chip, Vacio } from '@/shared/ui/primitivos';
import type { CuartoConTipo } from '@/modules/cuartos/domain/tipos';
import { ESTILO_ESTADO } from '@/modules/cuartos/ui/estados';
import { ChecklistInspeccion } from './ChecklistInspeccion';
import type { Inspeccion, PlantillaInspeccion } from '../domain/tipos';
import { fechaYHora } from '@/shared/ui/fechas';

/**
 * Inspección post check-out. Portada de `openInspeccion()` del prototipo.
 *
 * Diferencia con el mockup: allí eran casillas de sí/no. Aquí se cuenta, porque lo que
 * el hostal necesita saber no es "¿había toallas?" sino "¿faltó una?". Guardar la
 * inspección NO descuenta inventario: un faltante se registra aparte y con motivo,
 * y siempre lo decide una persona.
 */
export function VistaInspeccion({
  cuartos,
  plantilla,
  historial,
}: {
  cuartos: CuartoConTipo[];
  plantilla: PlantillaInspeccion | null;
  historial: Inspeccion[];
}) {
  const router = useRouter();

  function elegir(cuartoId: string) {
    router.push(`/inspeccion?cuarto=${cuartoId}`);
  }

  // Con habitación elegida, manda el checklist. Es el mismo que abre el cajón.
  if (plantilla) {
    return <ChecklistInspeccion plantilla={plantilla} onCerrar={() => router.push('/inspeccion')} />;
  }

  // ------------------------------------------------------- elegir habitación

  /** Lo que toca revisar primero: lo que acaba de salir o quedó marcado para inspección. */
  const porRevisar = cuartos.filter((c) => c.estado === 'checkout' || c.estado === 'inspeccion');
  const resto = cuartos.filter((c) => !porRevisar.includes(c));

  return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-tx-muted">
            Por revisar
          </p>
          {porRevisar.length === 0 ? (
            <Vacio
              titulo="No hay nada esperando inspección"
              detalle="Aquí aparecen las habitaciones recién desocupadas."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {porRevisar.map((c) => {
                const e = ESTILO_ESTADO[c.estado];
                return (
                  <button type="button"
                    key={c.id}
                    onClick={() => elegir(c.id)}
                    className="card relative overflow-hidden rounded-xl bg-surf hair p-4 text-left transition-transform hover:-translate-y-0.5 hover:bg-surf-hover cursor-pointer"
                  >
                    <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: e.color }} />
                    <div className="flex items-center justify-between gap-2 pl-1.5">
                      <span className="text-[20px] font-bold leading-none">{c.numero}</span>
                      <Chip tono="muted">
                        <span style={{ color: e.color }}>{e.etiqueta}</span>
                      </Chip>
                    </div>
                    <p className="mt-1 pl-1.5 text-[12px] text-tx-muted">{c.tipo}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {resto.length > 0 && (
          <details className="rounded-xl bg-surf hair px-4 py-3">
            <summary className="cursor-pointer text-[13px] text-tx-sec">
              Inspeccionar otra habitación
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {resto.map((c) => (
                <button type="button"
                  key={c.id}
                  onClick={() => elegir(c.id)}
                  className="rounded-md bg-bg-ter hair px-3 py-1.5 text-[13px] text-tx-sec transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
                >
                  {c.numero}
                </button>
              ))}
            </div>
          </details>
        )}

        {historial.length > 0 && (
          <div>
            <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-tx-muted">
              Últimas inspecciones
            </p>
            <div className="flex flex-col gap-2">
              {historial.slice(0, 8).map((h) => {
                const faltan = h.resultado.filter((r) => r.confirmado < r.esperado).length;
                return (
                  <Card key={h.id} padding="p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] font-semibold">{h.cuartos?.numero ?? '—'}</span>
                      <span className="text-[12.5px] text-tx-muted">{fechaYHora(h.created_at)}</span>
                      <div className="ml-auto">
                        {faltan > 0 ? (
                          <Chip tono="warning">
                            {faltan} faltante{faltan > 1 ? 's' : ''}
                          </Chip>
                        ) : (
                          <Chip tono="success">Todo completo</Chip>
                        )}
                      </div>
                    </div>
                    {h.nota && <p className="mt-1.5 text-[13px] text-tx-sec">{h.nota}</p>}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
}
