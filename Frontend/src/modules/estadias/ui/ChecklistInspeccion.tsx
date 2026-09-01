'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as Iconos from 'lucide-react';
import { Boton, Card, ErrorCaja } from '@/shared/ui/primitivos';
import { CapturaFoto } from '@/modules/medios/ui/CapturaFoto';
import { guardarInspeccion } from '../infrastructure/acciones';
import type { ItemInspeccion, PlantillaInspeccion } from '../domain/tipos';

/**
 * El checklist de una habitación concreta.
 *
 * Vive aparte de la vista porque se usa en dos sitios: la página `/inspeccion` y el
 * cajón que se abre desde el panel de una habitación, que es como lo hace el mockup
 * (`openInspeccion()` desde las acciones rápidas del cuarto).
 *
 * En el mockup eran casillas de sí/no. Aquí se **cuenta**, porque lo que el hostal
 * necesita saber no es «¿había toallas?» sino «¿faltó una?». Guardar la inspección no
 * descuenta inventario: el faltante se registra aparte y con motivo.
 */

function Icono({ nombre, className }: { nombre?: string; className?: string }) {
  if (!nombre) return null;
  const pascal = nombre
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const C = (Iconos as unknown as Record<string, React.ComponentType<{ className?: string }>>)[pascal];
  return C ? <C className={className} /> : null;
}

/** Tarjeta en la página, nada en el cajón. Fuera del componente: si no, React lo trata
 * como un tipo distinto en cada render y remonta el checklist a cada tecla. */
function Marco({ enCajon, children }: { enCajon: boolean; children: React.ReactNode }) {
  if (enCajon) return <>{children}</>;
  return <Card padding="p-5">{children}</Card>;
}

export function ChecklistInspeccion({
  plantilla,
  enCajon = false,
  onCerrar,
}: {
  plantilla: PlantillaInspeccion;
  /** En el cajón el marco lo pone el cajón: aquí sobra la tarjeta y el ancho máximo. */
  enCajon?: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();

  const [items, setItems] = useState<ItemInspeccion[]>(plantilla.items);
  const [nota, setNota] = useState('');
  const [aLimpieza, setALimpieza] = useState(true);
  const [medioId, setMedioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ faltantes: number } | null>(null);
  const [guardando, empezar] = useTransition();

  const faltantes = items.filter((i) => i.confirmado < i.esperado);

  function contar(indice: number, delta: number) {
    setItems((prev) =>
      prev.map((x, i) =>
        i === indice
          ? { ...x, confirmado: Math.max(0, Math.min(x.esperado, x.confirmado + delta)) }
          : x
      )
    );
  }

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await guardarInspeccion({
        cuarto_id: plantilla.cuarto.id,
        estadia_id: plantilla.estadia_id,
        resultado: items,
        nota: nota.trim() || undefined,
        medio_id: medioId,
        pasar_a_limpieza: aLimpieza,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setHecho({ faltantes: r.datos.faltantes });
      router.refresh();
    });
  }

  // ------------------------------------------------------------------ hecho

  if (hecho) {
    return (
      <div className={enCajon ? '' : 'mx-auto max-w-xl'}>
        <Marco enCajon={enCajon}>
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15">
              <Iconos.Check className="size-[18px] text-success" />
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-semibold">
                Habitación {plantilla.cuarto.numero} inspeccionada
              </p>
              <p className="mt-1 text-[13.5px] text-tx-sec">
                {hecho.faltantes === 0
                  ? 'No falta nada.'
                  : `Quedaron ${hecho.faltantes} ítem(s) por debajo de lo esperado. El descuento de inventario se registra aparte, con motivo.`}
                {aLimpieza && ' La habitación pasó a limpieza.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Boton variante="primario" onClick={onCerrar}>
                  {enCajon ? 'Cerrar' : 'Inspeccionar otra'}
                </Boton>
                {!enCajon && (
                  <Boton onClick={() => router.push('/habitaciones')}>Ver habitaciones</Boton>
                )}
              </div>
            </div>
          </div>
        </Marco>
      </div>
    );
  }

  // ------------------------------------------------------------- checklist

  return (
    <div className={enCajon ? '' : 'mx-auto max-w-xl'}>
      <Marco enCajon={enCajon}>
        {!enCajon && (
          <div className="mb-4 flex items-center gap-3">
            <div>
              <p className="text-[24px] font-bold leading-none tracking-tight">
                {plantilla.cuarto.numero}
              </p>
              <p className="mt-1 text-[13px] text-tx-sec">
                {plantilla.estadia_id ? 'Tras el check-out' : 'Sin estadía asociada'}
              </p>
            </div>
            <button type="button"
              onClick={onCerrar}
              className="ml-auto grid size-8 place-items-center rounded-md text-tx-muted transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
              aria-label="Elegir otra habitación"
            >
              <Iconos.X className="size-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {items.map((item, i) => {
            const falta = item.confirmado < item.esperado;
            return (
              <div
                key={item.item}
                className={`flex items-center gap-3 rounded-md hair px-3 py-2.5 transition-colors ${
                  falta ? 'bg-warning/10' : 'bg-surf'
                }`}
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-md bg-bg-ter">
                  <Icono nombre={item.icono} className="size-4 text-tx-sec" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">{item.item}</p>
                  <p className="text-[11.5px] text-tx-muted">Esperado: {item.esperado}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => contar(i, -1)}
                    disabled={item.confirmado === 0}
                    aria-label={`Uno menos de ${item.item}`}
                    className="grid size-8 place-items-center rounded-md hair text-[15px] text-tx-sec transition-colors hover:bg-surf-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span
                    className={`w-7 text-center text-[14px] font-semibold tabular-nums ${
                      falta ? 'text-warning' : ''
                    }`}
                  >
                    {item.confirmado}
                  </span>
                  <button
                    type="button"
                    onClick={() => contar(i, 1)}
                    disabled={item.confirmado >= item.esperado}
                    aria-label={`Uno más de ${item.item}`}
                    className="grid size-8 place-items-center rounded-md hair text-[15px] text-tx-sec transition-colors hover:bg-surf-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {faltantes.length > 0 && (
          <p className="up mt-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-[12.5px] text-warning bg-warning/10">
            <Iconos.TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Falta: {faltantes.map((f) => `${f.item} (${f.esperado - f.confirmado})`).join(', ')}.
            Queda registrado, pero no descuenta stock: eso se hace aparte y con motivo.
          </p>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Nota (opcional)</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Qué se vio, quién estaba, cualquier cosa que valga la pena recordar."
            className="w-full resize-none rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx placeholder:text-tx-dis focus:border-brand-500"
          />
        </label>

        <div className="mt-3">
          <CapturaFoto
            tipo="inspeccion"
            estadiaId={plantilla.estadia_id}
            etiqueta="Foto de lo que encontraste"
            onSubida={setMedioId}
          />
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13.5px]">
          <input
            type="checkbox"
            checked={aLimpieza}
            onChange={(e) => setALimpieza(e.target.checked)}
            className="size-4 accent-[#7C4DFF]"
          />
          Enviar la habitación a limpieza al guardar
        </label>

        {error && (
          <div className="mt-4">
            <ErrorCaja mensaje={error} />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Boton className="flex-1" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" className="flex-[2]" onClick={guardar} disabled={guardando}>
            <Iconos.ClipboardCheck className="size-4" />
            {guardando ? 'Guardando…' : 'Confirmar inspección'}
          </Boton>
        </div>
      </Marco>
    </div>
  );
}
