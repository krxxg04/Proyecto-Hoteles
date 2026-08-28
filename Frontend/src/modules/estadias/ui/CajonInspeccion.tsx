'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { pedirCliente } from '@/shared/api/navegador';
import { Esqueleto, ErrorCaja } from '@/shared/ui/primitivos';
import { ChecklistInspeccion } from './ChecklistInspeccion';
import type { PlantillaInspeccion } from '../domain/tipos';

/**
 * Inspección en un cajón lateral, como en el mockup.
 *
 * Allí `openInspeccion()` se llama desde las acciones rápidas de una habitación, no
 * desde el menú: se inspecciona *una habitación concreta* mientras se la está mirando.
 * Meterlo en la barra lateral obligaba a elegir el cuarto otra vez, en una pantalla
 * aparte, después de haberlo tenido delante.
 */

export const EVENTO_ABRIR_INSPECCION = 'hostal:abrir-inspeccion';

/** Lo dispara quien quiera abrirla, con el id de la habitación. */
export function abrirInspeccion(cuartoId: string) {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_INSPECCION, { detail: cuartoId }));
}

export function CajonInspeccion() {
  const [cuartoId, setCuartoId] = useState<string | null>(null);
  const [plantilla, setPlantilla] = useState<PlantillaInspeccion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cerrar = useCallback(() => {
    setCuartoId(null);
    setPlantilla(null);
    setError(null);
  }, []);

  useEffect(() => {
    const abrir = (e: Event) => {
      setPlantilla(null);
      setError(null);
      setCuartoId((e as CustomEvent<string>).detail);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };

    window.addEventListener(EVENTO_ABRIR_INSPECCION, abrir);
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener(EVENTO_ABRIR_INSPECCION, abrir);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [cerrar]);

  useEffect(() => {
    if (!cuartoId) return;
    let vigente = true;

    void (async () => {
      const r = await pedirCliente<PlantillaInspeccion>(
        `/api/inspecciones?plantilla=1&cuarto_id=${cuartoId}`
      );
      if (!vigente) return;
      if (r.ok) setPlantilla(r.datos);
      else setError(r.error);
    })();

    return () => {
      vigente = false;
    };
  }, [cuartoId]);

  useEffect(() => {
    if (!cuartoId) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [cuartoId]);

  if (!cuartoId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[2px]"
      onClick={cerrar}
    >
      <aside
        className="up flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surf-float shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Inspección"
      >
        <div className="glass sticky top-0 z-10 flex h-16 items-center gap-3 hair-b px-4 backdrop-blur">
          <button
            onClick={cerrar}
            aria-label="Cerrar la inspección"
            className="grid size-8 shrink-0 place-items-center rounded-md text-tx-sec transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <X className="size-[18px]" />
          </button>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-tight">
              Inspección{plantilla ? ` · ${plantilla.cuarto.numero}` : ''}
            </p>
            <p className="text-[12px] text-tx-muted">
              {plantilla?.estadia_id ? 'Tras el check-out' : 'Cuenta lo que encuentres'}
            </p>
          </div>
        </div>

        <div className="p-4">
          {error && <ErrorCaja mensaje={error} />}

          {!plantilla && !error && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Esqueleto key={i} alto="h-14" />
              ))}
            </div>
          )}

          {plantilla && <ChecklistInspeccion plantilla={plantilla} enCajon onCerrar={cerrar} />}
        </div>
      </aside>
    </div>
  );
}
