'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, X } from 'lucide-react';
import type { Huesped } from '../domain/tipos';
import { Chip, Vacio } from '@/shared/ui/primitivos';
import { Celda, EncabezadoSeccion, Fila, Tabla } from '@/shared/ui/tabla';

/**
 * Registro de personas. El estado va como columna líder, según los docs Atlas.
 *
 * Nunca se dice "lista negra": `requiere_revision` es una marca neutra que exige
 * evidencia y que decida un humano.
 */
export function VistaHuespedes({ huespedes, busqueda }: { huespedes: Huesped[]; busqueda: string }) {
  const router = useRouter();
  const [q, setQ] = useState(busqueda);
  const [abierto, setAbierto] = useState<Huesped | null>(null);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/huespedes?q=${encodeURIComponent(q.trim())}` : '/huespedes');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoSeccion
        titulo="Huéspedes"
        subtitulo="Personas registradas en el hostal"
        accion={
          <form onSubmit={buscar} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tx-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre o documento"
              aria-label="Buscar huésped"
              className="w-56 rounded-md bg-bg-ter hair py-2 pl-9 pr-3 text-[13px] text-tx placeholder:text-tx-dis"
            />
          </form>
        }
      />

      {huespedes.length === 0 ? (
        <Vacio
          titulo={busqueda ? `Nadie coincide con «${busqueda}»` : 'Todavía no hay huéspedes'}
          detalle={busqueda ? undefined : 'Se registran solos al hacer el primer check-in.'}
        />
      ) : (
        <Tabla columnas={['Estado', 'Nombre', 'Documento', 'Teléfono', 'Desde', '']}>
          {huespedes.map((h) => (
            <Fila key={h.id} onClick={() => setAbierto(h)}>
              <Celda>
                {h.requiere_revision ? (
                  <Chip tono="warning">En revisión</Chip>
                ) : (
                  <Chip tono="success">Al día</Chip>
                )}
              </Celda>
              <Celda className="font-medium">{h.nombre}</Celda>
              <Celda className="tabular-nums text-tx-sec" oculta="sm">
                {h.tipo_doc} {h.num_doc}
              </Celda>
              <Celda className="tabular-nums text-tx-sec" oculta="md">
                {h.telefono ?? '—'}
              </Celda>
              <Celda className="text-tx-muted" oculta="md">
                {new Date(h.created_at).toLocaleDateString('es-PE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Celda>
              <Celda className="text-right">
                <ChevronRight className="inline size-4 text-tx-muted" />
              </Celda>
            </Fila>
          ))}
        </Tabla>
      )}

      {abierto && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/50"
          onClick={() => setAbierto(null)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`Huésped ${abierto.nombre}`}
            className="up h-full w-full max-w-sm overflow-y-auto bg-surf-float px-5 py-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[19px] font-semibold tracking-tight">{abierto.nombre}</p>
                <p className="mt-1 text-[13px] text-tx-sec tabular-nums">
                  {abierto.tipo_doc} {abierto.num_doc}
                </p>
              </div>
              <button
                onClick={() => setAbierto(null)}
                aria-label="Cerrar"
                className="grid size-8 place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {abierto.requiere_revision && (
              <div
                className="mb-4 rounded-lg px-3.5 py-3 text-[12.5px]"
                style={{ background: 'rgba(245,158,11,.12)', color: '#F59E0B' }}
              >
                Marcado para revisión. Es una nota interna: exige evidencia y que una persona
                decida. No bloquea nada por sí sola.
              </div>
            )}

            <dl className="flex flex-col gap-3 text-[13px]">
              {[
                ['Teléfono', abierto.telefono],
                ['Correo', abierto.email],
                ['Nacionalidad', abierto.nacionalidad],
                ['Notas', abierto.notas],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta as string}>
                  <dt className="text-[12px] text-tx-muted">{etiqueta}</dt>
                  <dd className="mt-0.5">{valor || <span className="text-tx-dis">—</span>}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
