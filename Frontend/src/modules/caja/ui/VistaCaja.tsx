'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, LockOpen, Lock, TriangleAlert, X } from 'lucide-react';
import type { EstadoCaja, LineaConteo, ResumenVentas } from '../domain/tipos';
import { abrirTurno, cerrarTurno, conteoEsperado } from '../infrastructure/acciones';
import { ETIQUETA_MEDIO, MEDIOS_PAGO } from '@/shared/dominio/tipos';
import { Boton, Campo, Card, ErrorCaja, soles } from '@/shared/ui/primitivos';
import { EncabezadoSeccion } from '@/shared/ui/tabla';
import { hora } from '@/shared/ui/fechas';

/**
 * Caja y turno. El cierre exige contar el inventario y justificar cada descuadre:
 * si falta una justificación, la función SQL aborta el cierre entero.
 */

export function VistaCaja({ caja, ventas }: { caja: EstadoCaja; ventas: ResumenVentas }) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [cerrando, setCerrando] = useState<LineaConteo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const abierto = !!caja.turno;

  function pedirConteo() {
    setError(null);
    empezar(async () => {
      const r = await conteoEsperado();
      if (!r.ok) setError(r.error);
      else setCerrando(r.datos);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoSeccion
        titulo="Caja"
        subtitulo={abierto ? 'Turno abierto' : 'Sin turno abierto'}
        accion={
          abierto ? (
            <Boton variante="primario" onClick={pedirConteo} disabled={ocupado}>
              <Lock className="size-4" />
              Cerrar turno
            </Boton>
          ) : (
            <Boton variante="primario" onClick={() => setAbriendo(true)}>
              <LockOpen className="size-4" />
              Abrir turno
            </Boton>
          )
        }
      />

      {caja.es_de_otro && (
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{ background: 'rgba(245,158,11,.12)' }}
        >
          <TriangleAlert className="size-[18px] shrink-0 text-warning" />
          <p className="text-[13.5px]">
            Este turno lo abrió <strong className="font-semibold">{caja.usuario}</strong>. Solo un
            administrador puede cerrarlo.
          </p>
        </div>
      )}

      {error && <ErrorCaja mensaje={error} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[12px] text-tx-muted">Sencillo actual</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums">{soles(caja.sencillo_esperado)}</p>
        </Card>
        <Card>
          <p className="text-[12px] text-tx-muted">Caja chica acumulada</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums" style={{ color: '#7C4DFF' }}>
            {soles(caja.caja_chica)}
          </p>
        </Card>
        <Card>
          <p className="text-[12px] text-tx-muted">Recaudado en el turno</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums">{soles(ventas.total)}</p>
          <p className="mt-1 text-[12px] text-tx-muted">{ventas.cantidad} operaciones</p>
        </Card>
      </div>

      {/* Desglose por medio de pago: es lo que hay que cuadrar al cerrar. */}
      <Card>
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-tx-muted">
          Por medio de pago
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MEDIOS_PAGO.map((m) => {
            const monto = ventas.por_medio[m] ?? 0;
            return (
              <div key={m} className="rounded-lg bg-bg-ter px-3.5 py-3">
                <p className="text-[12px] text-tx-muted">{ETIQUETA_MEDIO[m]}</p>
                <p className="mt-1 text-[17px] font-semibold tabular-nums">{soles(monto)}</p>
              </div>
            );
          })}
        </div>
        {ventas.total > 0 && (
          <p className="mt-3 text-[12px] text-tx-muted">
            El efectivo es lo único que se cuenta a mano al cerrar. Yape, Plin y tarjeta se cuadran
            contra sus reportes.
          </p>
        )}
      </Card>

      {abierto && caja.turno && (
        <Card>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-tx-muted" />
              <span className="text-tx-sec">Abierto por</span>
              <strong className="font-medium">{caja.usuario ?? '—'}</strong>
            </div>
            <div>
              <span className="text-tx-sec">Desde </span>
              <strong className="font-medium tabular-nums">
                {hora(caja.turno.abierto_at)}
              </strong>
            </div>
            <div>
              <span className="text-tx-sec">Efectivo de apertura </span>
              <strong className="font-medium tabular-nums">
                {soles(caja.turno.sencillo_apertura)}
              </strong>
            </div>
          </div>
        </Card>
      )}

      {abriendo && (
        <DialogoApertura
          esperado={caja.sencillo_esperado}
          onCerrar={() => setAbriendo(false)}
          onHecho={() => {
            setAbriendo(false);
            router.refresh();
          }}
        />
      )}

      {cerrando && (
        <DialogoCierre
          lineas={cerrando}
          efectivoEsperado={caja.turno ? caja.turno.sencillo_apertura + (ventas.por_medio.efectivo ?? 0) : 0}
          onCerrar={() => setCerrando(null)}
          onHecho={() => {
            setCerrando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Modal({
  titulo,
  subtitulo,
  onCerrar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/50 p-4" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop my-auto w-full max-w-lg rounded-xl bg-surf-float p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">{titulo}</p>
            {subtitulo && <p className="mt-0.5 text-[13px] text-tx-sec">{subtitulo}</p>}
          </div>
          <button type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-8 place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogoApertura({
  esperado,
  onCerrar,
  onHecho,
}: {
  esperado: number;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [contado, setContado] = useState(String(esperado));
  const [justificacion, setJustificacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  const diferencia = Number(contado) - esperado;
  const cuadra = Math.abs(diferencia) < 0.005;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    empezar(async () => {
      const r = await abrirTurno({
        efectivo_contado: Number(contado),
        justificacion: justificacion || undefined,
      });
      if (!r.ok) setError(r.error);
      else onHecho();
    });
  }

  return (
    <Modal titulo="Abrir turno" subtitulo="Cuenta el efectivo que hay en caja" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="rounded-lg bg-bg-ter px-3.5 py-3">
          <p className="text-[12px] text-tx-muted">El turno anterior dejó</p>
          <p className="mt-0.5 text-[19px] font-semibold tabular-nums">{soles(esperado)}</p>
        </div>

        <Campo
          etiqueta="Efectivo contado"
          type="number"
          step="0.10"
          min="0"
          autoFocus
          value={contado}
          onChange={(e) => setContado(e.target.value)}
        />

        {!cuadra && (
          <>
            <div
              className="rounded-md px-3 py-2 text-[12.5px]"
              style={{ background: 'rgba(245,158,11,.12)', color: '#F59E0B' }}
            >
              Hay una diferencia de {soles(Math.abs(diferencia))}{' '}
              {diferencia > 0 ? 'de más' : 'de menos'}. Explica por qué.
            </div>
            <Campo
              etiqueta="Justificación"
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Qué pasó"
            />
          </>
        )}

        {error && <ErrorCaja mensaje={error} />}

        <div className="mt-1 flex gap-2">
          <Boton type="submit" variante="primario" disabled={enviando} className="flex-1">
            {enviando ? 'Abriendo…' : 'Abrir turno'}
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

function DialogoCierre({
  lineas,
  efectivoEsperado,
  onCerrar,
  onHecho,
}: {
  lineas: LineaConteo[];
  efectivoEsperado: number;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [conteos, setConteos] = useState<Record<string, string>>(
    Object.fromEntries(lineas.map((l) => [l.producto_id, String(l.esperado)]))
  );
  const [justificaciones, setJustificaciones] = useState<Record<string, string>>({});
  const [sencillo, setSencillo] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await cerrarTurno({
        conteos: lineas.map((l) => ({
          producto_id: l.producto_id,
          contado: Number(conteos[l.producto_id] ?? 0),
          justificacion: justificaciones[l.producto_id] || undefined,
        })),
        sencillo_dejar: Number(sencillo),
      });
      if (!r.ok) setError(r.error);
      else onHecho();
    });
  }

  return (
    <Modal
      titulo="Cerrar turno"
      subtitulo="Cuenta el inventario. Todo descuadre necesita explicación."
      onCerrar={onCerrar}
    >
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="max-h-72 overflow-y-auto rounded-lg hair">
          {lineas.map((l) => {
            const contado = Number(conteos[l.producto_id] ?? 0);
            const diferencia = l.esperado - contado;
            const descuadra = Math.abs(diferencia) > 0.005;

            return (
              <div key={l.producto_id} className="hair-b p-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{l.nombre}</p>
                    <p className="text-[11.5px] text-tx-muted">
                      Debería haber {l.esperado} {l.unidad}
                    </p>
                  </div>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    aria-label={`Contado de ${l.nombre}`}
                    value={conteos[l.producto_id] ?? ''}
                    onChange={(e) =>
                      setConteos({ ...conteos, [l.producto_id]: e.target.value })
                    }
                    className="w-20 rounded-md bg-bg-ter hair px-2.5 py-1.5 text-right text-[13px] tabular-nums"
                  />
                </div>

                {descuadra && (
                  <div className="mt-2">
                    <p className="mb-1 text-[11.5px]" style={{ color: '#F59E0B' }}>
                      {diferencia > 0 ? `Faltan ${diferencia}` : `Sobran ${Math.abs(diferencia)}`}{' '}
                      {l.unidad}
                    </p>
                    <input
                      value={justificaciones[l.producto_id] ?? ''}
                      onChange={(e) =>
                        setJustificaciones({ ...justificaciones, [l.producto_id]: e.target.value })
                      }
                      placeholder="Explica el descuadre"
                      aria-label={`Justificación de ${l.nombre}`}
                      className="w-full rounded-md bg-bg-ter hair px-2.5 py-1.5 text-[12.5px]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-bg-ter px-3.5 py-3">
          <p className="text-[12px] text-tx-muted">Efectivo en caja</p>
          <p className="mt-0.5 text-[19px] font-semibold tabular-nums">{soles(efectivoEsperado)}</p>
        </div>

        <Campo
          etiqueta="Sencillo que dejas para el siguiente turno"
          type="number"
          step="0.10"
          min="0"
          value={sencillo}
          onChange={(e) => setSencillo(e.target.value)}
        />
        <p className="text-[12px] text-tx-muted">
          El resto ({soles(Math.max(0, efectivoEsperado - Number(sencillo || 0)))}) pasa a caja chica.
        </p>

        {error && <ErrorCaja mensaje={error} />}

        <div className="mt-1 flex gap-2">
          <Boton type="submit" variante="primario" disabled={enviando} className="flex-1">
            {enviando ? 'Cerrando…' : 'Cerrar turno'}
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
