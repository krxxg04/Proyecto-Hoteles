'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import type { CuartoConTipo, TipoCuarto } from '../domain/tipos';
import { ESTILO_ESTADO } from './estados';
import { guardarTipoCuarto } from '../infrastructure/acciones';
import { Boton, Campo, Card, Chip, ErrorCaja, soles } from '@/shared/ui/primitivos';
import { Celda, EncabezadoSeccion, Fila, Tabla } from '@/shared/ui/tabla';

/**
 * Cuartos y tarifario. El precio de cada estadía sale de aquí, nunca del cliente.
 *
 * `plan.md` lo marcaba como pendiente: «el precio del check-in debe tomar el tarifario
 * que configuren Admin y Recepción, no valores hardcodeados». La cotización ya lo hacía;
 * lo que faltaba era poder cambiarlo sin entrar a la base.
 */

/** Los campos del tarifario, en el orden en que se piensan en un mostrador. */
const CAMPOS: Array<{ clave: keyof TipoCuarto; etiqueta: string; sufijo?: string }> = [
  { clave: 'aforo', etiqueta: 'Aforo', sufijo: 'personas' },
  { clave: 'horas_lj', etiqueta: 'Horas del bloque (L-J)', sufijo: 'h' },
  { clave: 'horas_vd', etiqueta: 'Horas del bloque (V-D)', sufijo: 'h' },
  { clave: 'costo', etiqueta: 'Precio del bloque', sufijo: 'S/' },
  { clave: 'hora_extra', etiqueta: 'Hora extra', sufijo: 'S/' },
  { clave: 'amanecida', etiqueta: 'Noche L-J', sufijo: 'S/' },
  { clave: 'amanecida_vd', etiqueta: 'Noche V-D', sufijo: 'S/' },
  { clave: 'deposito', etiqueta: 'Depósito', sufijo: 'S/' },
];

function FormularioTarifa({
  tipo,
  onCerrar,
}: {
  tipo: TipoCuarto;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<TipoCuarto>(tipo);
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await guardarTipoCuarto(valores);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onCerrar();
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(ev) => ev.stopPropagation()}
        className="pop max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surf-float hair p-5"
        style={{ boxShadow: 'var(--elev-8)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">{tipo.nombre}</p>
            <p className="mt-0.5 text-[12.5px] text-tx-muted">
              Lo que cambies aquí es lo que cobrará el próximo check-in.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Campo
            etiqueta="Nombre"
            value={valores.nombre}
            onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            {CAMPOS.map((c) => (
              <Campo
                key={String(c.clave)}
                etiqueta={`${c.etiqueta}${c.sufijo ? ` (${c.sufijo})` : ''}`}
                type="number"
                min={0}
                step={c.clave === 'aforo' || c.clave === 'horas_lj' || c.clave === 'horas_vd' ? 1 : 0.5}
                value={String(valores[c.clave] ?? 0)}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [c.clave]: Number(e.target.value) || 0 }))
                }
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3">
            <ErrorCaja mensaje={error} />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Boton type="button" variante="fantasma" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" className="flex-[2]" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar tarifa'}
          </Boton>
        </div>
      </form>
    </div>
  );
}

export function VistaCuartosAdmin({
  cuartos,
  tipos,
}: {
  cuartos: CuartoConTipo[];
  tipos: TipoCuarto[];
}) {
  const [editando, setEditando] = useState<TipoCuarto | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <EncabezadoSeccion titulo="Tarifario" subtitulo="Lo que cobra cada tipo de cuarto" />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tipos.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14.5px] font-semibold">{t.nombre}</p>
                <div className="flex items-center gap-1.5">
                  <Chip tono="muted">aforo {t.aforo}</Chip>
                  <button
                    onClick={() => setEditando(t)}
                    aria-label={`Editar la tarifa de ${t.nombre}`}
                    className="grid size-7 place-items-center rounded-md text-tx-muted transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              </div>

              <dl className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Bloque de {t.horas_lj} h (L-J)</dt>
                  <dd className="tabular-nums">{soles(t.costo)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Hora extra</dt>
                  <dd className="tabular-nums">{soles(t.hora_extra)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Noche L-J</dt>
                  <dd className="tabular-nums">{soles(t.amanecida)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Noche V-D</dt>
                  <dd className="tabular-nums">{soles(t.amanecida_vd)}</dd>
                </div>
                <div className="hair-t flex justify-between pt-1.5">
                  <dt className="text-tx-muted">Depósito</dt>
                  <dd className="tabular-nums">{soles(t.deposito)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <EncabezadoSeccion titulo="Cuartos" subtitulo={`${cuartos.length} habitaciones activas`} />

        <Tabla columnas={['Número', 'Tipo', 'Estado', 'Aforo', 'Características']}>
          {cuartos.map((c) => {
            const e = ESTILO_ESTADO[c.estado];
            return (
              <Fila key={c.id}>
                <Celda className="text-[15px] font-semibold tabular-nums">{c.numero}</Celda>
                <Celda className="text-tx-sec">{c.tipo}</Celda>
                <Celda>
                  <Chip tono="muted">
                    <span style={{ color: e.color }}>{e.etiqueta}</span>
                  </Chip>
                </Celda>
                <Celda className="tabular-nums text-tx-sec" oculta="sm">
                  {c.aforo}
                </Celda>
                <Celda oculta="md">
                  <div className="flex flex-wrap gap-1">
                    {c.caracteristicas.length === 0 ? (
                      <span className="text-tx-dis">—</span>
                    ) : (
                      c.caracteristicas.map((x) => (
                        <Chip key={x} tono="brand">
                          {x.replace('_', ' ')}
                        </Chip>
                      ))
                    )}
                  </div>
                </Celda>
              </Fila>
            );
          })}
        </Tabla>
      </section>

      {editando && (
        <FormularioTarifa tipo={editando} onCerrar={() => setEditando(null)} />
      )}
    </div>
  );
}
