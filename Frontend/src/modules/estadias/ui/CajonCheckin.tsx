'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { pedirCliente } from '@/shared/api/navegador';
import { Esqueleto, ErrorCaja } from '@/shared/ui/primitivos';
import { VistaCheckin } from './VistaCheckin';
import type { Catalogos } from '../domain/tipos';
import type { EstadoCaja } from '@/modules/caja/domain/tipos';

/**
 * Check-in en un cajón lateral, como en el mockup.
 *
 * No es una página: recepción tiene a alguien delante del mostrador y estaba mirando
 * otra cosa. Abrir el check-in encima y cerrarlo deja la pantalla donde estaba, que es
 * justo lo que hace falta cuando se interrumpe a media tarea.
 *
 * Se abre con un evento del navegador y no con un `href`, para que pueda lanzarlo
 * cualquiera —el botón de la esquina, el panel de una habitación, Ctrl+K— sin tener que
 * levantar el estado hasta un componente común.
 */

export const EVENTO_ABRIR_CHECKIN = 'hostal:abrir-checkin';

/** Lo dispara quien quiera abrirlo. Sin importar nada de este archivo. */
export function abrirCheckin() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_CHECKIN));
}

export function CajonCheckin() {
  const [abierto, setAbierto] = useState(false);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [turnoAbierto, setTurnoAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerrar = useCallback(() => setAbierto(false), []);

  useEffect(() => {
    const abrir = () => setAbierto(true);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    window.addEventListener(EVENTO_ABRIR_CHECKIN, abrir);
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener(EVENTO_ABRIR_CHECKIN, abrir);
      window.removeEventListener('keydown', alTeclear);
    };
  }, []);

  /**
   * Los catálogos y el estado de caja se piden al abrir, no al cargar la aplicación:
   * son dos viajes que la mayoría de las pantallas no necesita.
   */
  useEffect(() => {
    if (!abierto || catalogos) return;
    let vigente = true;

    void (async () => {
      const [cat, caja] = await Promise.all([
        pedirCliente<Catalogos>('/api/catalogos'),
        pedirCliente<EstadoCaja>('/api/turno'),
      ]);
      if (!vigente) return;

      if (!cat.ok) {
        setError(cat.error);
        return;
      }
      setCatalogos(cat.datos);
      setTurnoAbierto(caja.ok && caja.datos.turno?.estado === 'abierto');
    })();

    return () => {
      vigente = false;
    };
  }, [abierto, catalogos]);

  // El fondo no debe hacer scroll detrás del cajón.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[2px]" onClick={cerrar}>
      <aside
        className="up flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surf-float shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Check-in rápido"
      >
        <div className="glass sticky top-0 z-10 flex h-16 items-center gap-3 hair-b px-4 backdrop-blur">
          <button
            onClick={cerrar}
            aria-label="Cerrar el check-in"
            className="grid size-8 shrink-0 place-items-center rounded-md text-tx-sec transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <X className="size-[18px]" />
          </button>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-tight">Check-in rápido</p>
            <p className="text-[12px] text-tx-muted">Cuatro pasos. Puedes cerrar y volver.</p>
          </div>
        </div>

        <div className="p-4">
          {error && <ErrorCaja mensaje={error} />}

          {!catalogos && !error && (
            <div className="flex flex-col gap-3">
              <Esqueleto alto="h-8" />
              {Array.from({ length: 5 }, (_, i) => (
                <Esqueleto key={i} alto="h-11" />
              ))}
            </div>
          )}

          {catalogos && (
            <VistaCheckin catalogos={catalogos} turnoAbierto={turnoAbierto} enCajon />
          )}
        </div>
      </aside>
    </div>
  );
}
