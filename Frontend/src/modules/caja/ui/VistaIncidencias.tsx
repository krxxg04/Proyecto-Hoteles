'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, TriangleAlert } from 'lucide-react';
import type { Incidencia } from '../domain/tipos';
import { revisarIncidencia } from '../infrastructure/acciones';
import { Boton, Card, Chip, ErrorCaja, Pildora, Vacio } from '@/shared/ui/primitivos';
import { EncabezadoSeccion } from '@/shared/ui/tabla';

/**
 * Descuadres del cierre de turno.
 *
 * "Revisada" significa que una persona la miró y decidió, no que el sistema la resolviera.
 * Nunca se acusa a nadie automáticamente — es regla de producto, no detalle de implementación.
 */
export function VistaIncidencias({ incidencias }: { incidencias: Incidencia[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<'abiertas' | 'todas'>('abiertas');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const visibles =
    filtro === 'abiertas' ? incidencias.filter((i) => i.estado === 'abierta') : incidencias;

  function revisar(id: string) {
    setError(null);
    empezar(async () => {
      const r = await revisarIncidencia(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoSeccion
        titulo="Incidencias"
        subtitulo="Descuadres registrados al cerrar turno"
      />

      <div className="flex gap-2">
        <Pildora activa={filtro === 'abiertas'} onClick={() => setFiltro('abiertas')}>
          Sin revisar ({incidencias.filter((i) => i.estado === 'abierta').length})
        </Pildora>
        <Pildora activa={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas ({incidencias.length})
        </Pildora>
      </div>

      {error && <ErrorCaja mensaje={error} />}

      {visibles.length === 0 ? (
        <Vacio
          titulo={filtro === 'abiertas' ? 'Nada pendiente de revisar' : 'Sin incidencias'}
          detalle="Las incidencias se crean solas cuando un conteo de cierre no cuadra."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.map((i) => {
            const falta = i.diferencia > 0;
            return (
              <Card key={i.id}>
                <div className="flex items-start gap-3">
                  <div
                    className="grid size-9 shrink-0 place-items-center rounded-md"
                    style={{ background: 'rgba(245,158,11,.14)' }}
                  >
                    <TriangleAlert className="size-[18px] text-warning" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold">{i.concepto}</p>
                      <Chip tono={i.estado === 'abierta' ? 'warning' : 'success'}>
                        {i.estado === 'abierta' ? 'Sin revisar' : 'Revisada'}
                      </Chip>
                    </div>

                    <p className="mt-1 text-[13px] text-tx-sec tabular-nums">
                      Esperado {i.esperado} · contado {i.contado} ·{' '}
                      <strong style={{ color: falta ? '#EF4444' : '#3B82F6' }}>
                        {falta ? 'faltan' : 'sobran'} {Math.abs(i.diferencia)} {i.unidad}
                      </strong>
                    </p>

                    <p className="mt-2 rounded-md bg-bg-ter px-3 py-2 text-[12.5px] text-tx-sec">
                      {i.justificacion}
                    </p>

                    <p className="mt-2 text-[11.5px] text-tx-muted">
                      {new Date(i.created_at).toLocaleString('es-PE', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {i.estado === 'abierta' && (
                    <Boton variante="secundario" disabled={ocupado} onClick={() => revisar(i.id)}>
                      <Check className="size-4" />
                      Revisada
                    </Boton>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
