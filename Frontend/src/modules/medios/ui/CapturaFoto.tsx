'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Trash2, TriangleAlert } from 'lucide-react';
import { Boton, ErrorCaja } from '@/shared/ui/primitivos';
import { subirFoto } from '../infrastructure/acciones';
import { EXIGE_CONSENTIMIENTO, type TipoMedio } from '../domain/tipos';

/**
 * Tomar una foto, comprimirla y subirla a R2.
 *
 * En tablet o móvil `capture="environment"` abre la cámara trasera directamente; en un
 * ordenador se cae al selector de archivos, que es lo correcto.
 *
 * Para `dni` y `rostro` no hay botón hasta que alguien marca que el huésped consintió.
 * No es una casilla de trámite: el backend la vuelve a exigir y registra la evidencia.
 */
export function CapturaFoto({
  tipo,
  huespedId,
  estadiaId,
  etiqueta,
  onSubida,
}: {
  tipo: TipoMedio;
  huespedId?: string | null;
  estadiaId?: string | null;
  etiqueta: string;
  onSubida: (medioId: string | null) => void;
}) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [subida, setSubida] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consiente, setConsiente] = useState(false);

  const pideConsentimiento = EXIGE_CONSENTIMIENTO.includes(tipo);
  const bloqueado = pideConsentimiento && !consiente;

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;

    setError(null);
    setSubiendo(true);
    setVistaPrevia(URL.createObjectURL(archivo));

    const r = await subirFoto(archivo, {
      tipo,
      huesped_id: huespedId,
      estadia_id: estadiaId,
      consentimiento: pideConsentimiento
        ? 'Consentimiento verbal del huésped, registrado en recepción'
        : undefined,
    });

    setSubiendo(false);

    if (!r.ok) {
      setError(r.error);
      setVistaPrevia(null);
      return;
    }

    setSubida(true);
    onSubida(r.datos.medio_id);
  }

  function quitar() {
    setVistaPrevia(null);
    setSubida(false);
    setError(null);
    onSubida(null);
    if (entradaRef.current) entradaRef.current.value = '';
  }

  return (
    <div className="rounded-lg bg-surf hair p-3">
      <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
        <Camera className="size-4 text-tx-muted" />
        {etiqueta}
        <span className="text-[11px] font-normal text-tx-muted">(opcional)</span>
      </p>

      {pideConsentimiento && (
        <label className="mb-2 flex cursor-pointer items-start gap-2 text-[12px] text-tx-sec">
          <input
            type="checkbox"
            checked={consiente}
            onChange={(e) => setConsiente(e.target.checked)}
            className="mt-0.5 size-3.5 accent-[#7C4DFF]"
          />
          <span>
            El huésped da su consentimiento para guardar esta foto. Se conserva 90 días y luego
            se borra sola.
          </span>
        </label>
      )}

      <input
        ref={entradaRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => elegir(e.target.files?.[0])}
      />

      {vistaPrevia ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vistaPrevia}
            alt="Foto tomada"
            className="size-16 rounded-md object-cover hair"
          />
          <div className="min-w-0 flex-1 text-[12.5px]">
            {subiendo && <span className="text-tx-muted">Comprimiendo y subiendo…</span>}
            {subida && (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="size-4" /> Guardada
              </span>
            )}
          </div>
          <Boton variante="fantasma" onClick={quitar} disabled={subiendo} aria-label="Quitar la foto">
            <Trash2 className="size-4" />
          </Boton>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Boton
            onClick={() => entradaRef.current?.click()}
            disabled={subiendo || bloqueado}
            title={bloqueado ? 'Falta marcar el consentimiento' : undefined}
          >
            <Camera className="size-4" />
            Tomar foto
          </Boton>
          {bloqueado && (
            <span className="flex items-center gap-1.5 text-[12px] text-tx-muted">
              <TriangleAlert className="size-3.5" />
              Falta el consentimiento
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2">
          <ErrorCaja mensaje={error} />
        </div>
      )}
    </div>
  );
}
