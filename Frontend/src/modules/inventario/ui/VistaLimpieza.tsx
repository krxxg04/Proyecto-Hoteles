'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { WashingMachine } from 'lucide-react';
import type { PendienteAseo } from '../domain/tipos';
import type { CuartoConTipo } from '@/modules/cuartos/domain/tipos';
import { marcarAseoListo } from '../infrastructure/acciones';
import { cambiarEstadoCuarto } from '@/modules/cuartos/infrastructure/acciones';
import { ESTILO_ESTADO } from '@/modules/cuartos/ui/estados';
import { ORDEN_TRABAJO, SIGUIENTE_PASO, ordenarPorTrabajo } from '@/modules/cuartos/ui/flujo';
import { Boton, Chip, ErrorCaja } from '@/shared/ui/primitivos';
import { EncabezadoSeccion } from '@/shared/ui/tabla';
import { useEnVivo } from '@/shared/ui/useEnVivo';
import { PuntoEnVivo } from '@/shared/ui/PuntoEnVivo';

/** Qué hay que limpiar ahora y qué está en lavandería. Portada del mockup. */

export function VistaLimpieza({
  cuartos,
  aseo,
}: {
  cuartos: CuartoConTipo[];
  aseo: PendienteAseo[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  // La otra mitad de la pizarra la mueve recepción desde la suya.
  const enVivo = useEnVivo('cuartos');

  // Mismo orden y mismos pasos que en Habitaciones: es la misma persona en la misma jornada.
  const porAtender = ordenarPorTrabajo(cuartos.filter((c) => ORDEN_TRABAJO.includes(c.estado)));

  function avanzar(cuarto: CuartoConTipo) {
    const estado = SIGUIENTE_PASO[cuarto.estado]?.estado;
    if (!estado) return;

    setError(null);
    empezar(async () => {
      const r = await cambiarEstadoCuarto({ cuarto_id: cuarto.id, estado });
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function listo(id: string) {
    setError(null);
    empezar(async () => {
      const r = await marcarAseoListo(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoSeccion
        titulo="Limpieza"
        subtitulo="Qué hay que atender ahora"
        accion={<PuntoEnVivo estado={enVivo} />}
      />

      {error && <ErrorCaja mensaje={error} />}

      <section>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-tx-muted">
          Cuartos por atender ({porAtender.length})
        </p>

        {porAtender.length === 0 ? (
          <p className="rounded-lg bg-surf hair px-4 py-6 text-center text-[13px] text-tx-muted">
            Todo limpio ✨
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {porAtender.map((c) => {
              const e = ESTILO_ESTADO[c.estado];
              const siguiente = SIGUIENTE_PASO[c.estado];
              return (
                <div
                  key={c.id}
                  className="card relative overflow-hidden rounded-xl bg-surf hair p-4"
                >
                  <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: e.color }} />
                  <div className="mb-1.5 flex items-center justify-between gap-2 pl-1.5">
                    <span className="text-[20px] font-bold leading-none tracking-tight">
                      {c.numero}
                    </span>
                    <Chip tono="muted">
                      <span style={{ color: e.color }}>{e.etiqueta}</span>
                    </Chip>
                  </div>
                  <p className="pl-1.5 text-[12px] text-tx-muted">{c.tipo}</p>

                  {siguiente && (
                    <Boton
                      variante="secundario"
                      disabled={ocupado}
                      onClick={() => avanzar(c)}
                      className="mt-3 w-full"
                    >
                      {siguiente.verbo}
                    </Boton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-tx-muted">
          Pendiente de lavandería ({aseo.length})
        </p>

        <div className="overflow-hidden rounded-lg bg-surf hair">
          {aseo.length === 0 ? (
            <p className="p-4 text-[13px] text-tx-muted">Nada pendiente de aseo.</p>
          ) : (
            aseo.map((a) => (
              <div key={a.id} className="hair-b flex items-center gap-3 p-3.5 last:border-0">
                <div
                  className="grid size-8 shrink-0 place-items-center rounded-md"
                  style={{ background: 'rgba(59,130,246,.14)' }}
                >
                  <WashingMachine className="size-4 text-info" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {a.cantidad} {a.productos?.unidad ?? ''} · {a.productos?.nombre ?? 'Producto'}
                  </p>
                  <p className="text-[11px] text-tx-muted">
                    {a.profiles?.nombre ?? '—'}
                    {a.cuartos?.numero ? ` · Hab. ${a.cuartos.numero}` : ''} ·{' '}
                    {new Date(a.enviado_at).toLocaleString('es-PE', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <Boton variante="secundario" disabled={ocupado} onClick={() => listo(a.id)}>
                  Listo
                </Boton>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
