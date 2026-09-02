'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, LockOpen, Lock, Plus, ShoppingCart, TriangleAlert, X } from 'lucide-react';
import type { CategoriaGasto, EstadoCaja, Gasto, LineaConteo, ResumenVentas } from '../domain/tipos';
import type { Producto } from '@/modules/inventario/domain/tipos';
import { abrirTurno, cerrarTurno, conteoEsperado, registrarGasto } from '../infrastructure/acciones';
import { ETIQUETA_MEDIO, MEDIOS_PAGO, type MedioPago } from '@/shared/dominio/tipos';
import { Boton, Campo, Card, Chip, ErrorCaja, Pildora, Vacio, soles } from '@/shared/ui/primitivos';
import { EncabezadoSeccion } from '@/shared/ui/tabla';
import { fechaYHora, hora } from '@/shared/ui/fechas';

/**
 * Caja y turno. El cierre exige contar el inventario y justificar cada descuadre:
 * si falta una justificación, la función SQL aborta el cierre entero.
 */

export function VistaCaja({
  caja,
  ventas,
  gastos,
  productos,
}: {
  caja: EstadoCaja;
  ventas: ResumenVentas;
  gastos: Gasto[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [cerrando, setCerrando] = useState<LineaConteo[] | null>(null);
  const [gastando, setGastando] = useState<CategoriaGasto | null>(null);
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
          <p className="text-[12px] text-tx-muted">
            {abierto ? 'Efectivo en caja ahora' : 'Efectivo en caja'}
          </p>
          <p className="mt-1 text-[22px] font-bold tabular-nums">{soles(caja.efectivo_esperado)}</p>
          {abierto && (
            <p className="mt-1 text-[12px] text-tx-muted">
              Apertura {soles(caja.turno?.sencillo_apertura ?? 0)} + ventas − gastos
            </p>
          )}
        </Card>
        <Card>
          <p className="text-[12px] text-tx-muted">Recaudado en el turno</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums">{soles(ventas.total)}</p>
          <p className="mt-1 text-[12px] text-tx-muted">{ventas.cantidad} operaciones</p>
        </Card>
        <Card>
          <p className="text-[12px] text-tx-muted">Gastado en el turno</p>
          <p
            className="mt-1 text-[22px] font-bold tabular-nums"
            style={{ color: caja.gastos_turno > 0 ? '#F59E0B' : undefined }}
          >
            {soles(caja.gastos_turno)}
          </p>
          <p className="mt-1 text-[12px] text-tx-muted">
            {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
          </p>
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

      {abierto && (
        <section>
          <EncabezadoSeccion
            titulo="Gastos del turno"
            subtitulo="Todo lo que sale de la caja queda aquí"
            accion={
              <>
                <Boton onClick={() => setGastando('fijo')}>
                  <ShoppingCart className="size-4" />
                  Comprar producto
                </Boton>
                <Boton onClick={() => setGastando('justificable')}>
                  <Plus className="size-4" />
                  Otro gasto
                </Boton>
              </>
            }
          />

          {gastos.length === 0 ? (
            <Vacio
              titulo="Sin gastos en este turno"
              detalle="Comprar un producto del catálogo llena el inventario y descuenta de la caja. Cualquier otro gasto necesita justificación."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {gastos.map((g) => (
                <Card key={g.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {g.categoria === 'fijo' ? (
                      <Chip tono="muted">fijo</Chip>
                    ) : (
                      <Chip tono="warning">justificable</Chip>
                    )}
                    <p className="text-[14px] font-medium">{g.concepto}</p>
                    {g.cantidad && (
                      <span className="text-[12.5px] text-tx-muted">
                        {g.cantidad} {g.productos?.unidad ?? ''}
                      </span>
                    )}
                    <span className="ml-auto text-[15px] font-semibold tabular-nums">
                      −{soles(g.monto)}
                    </span>
                    <span className="text-[12px] text-tx-muted">{ETIQUETA_MEDIO[g.medio]}</span>
                  </div>
                  {g.justificacion && (
                    <p className="mt-2 rounded-md bg-bg-ter px-3 py-2 text-[12.5px] text-tx-sec">
                      {g.justificacion}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11.5px] text-tx-muted">
                    {fechaYHora(g.created_at)}
                    {g.profiles?.nombre ? ` · ${g.profiles.nombre}` : ''}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {gastando && (
        <DialogoGasto
          categoria={gastando}
          productos={productos}
          enCaja={caja.efectivo_esperado}
          onCerrar={() => setGastando(null)}
          onHecho={() => {
            setGastando(null);
            router.refresh();
          }}
        />
      )}

      {abriendo && (
        <DialogoApertura
          esperado={caja.efectivo_esperado}
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
          efectivoEsperado={caja.efectivo_esperado}
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
  const [contado, setContado] = useState(String(efectivoEsperado));
  const [justificaCaja, setJustificaCaja] = useState('');
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
        efectivo_contado: Number(contado),
        justificacion_caja: justificaCaja || null,
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

        {/*
          Tres números en juego: lo esperado, lo contado y la diferencia. El campo pedía el
          contado pero venía relleno con lo esperado y debajo salía la diferencia, así que
          era fácil escribir la diferencia en el campo. Ahora el recuadro repite «Contaste»
          al lado de la diferencia y no hay dónde confundirse.
        */}
        <div className="rounded-lg bg-bg-ter px-3.5 py-3">
          <p className="text-[12px] text-tx-muted">Debería haber en la caja</p>
          <p className="mt-0.5 text-[19px] font-semibold tabular-nums">{soles(efectivoEsperado)}</p>
          <p className="mt-1 text-[11.5px] text-tx-muted">
            Apertura + ventas en efectivo − gastos en efectivo
          </p>
        </div>

        <Campo
          etiqueta="¿Cuánto efectivo hay de verdad? Cuéntalo (S/)"
          type="number"
          step="0.10"
          min="0"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
        />

        {/* El dinero se trata igual que el inventario: si no cuadra, alguien lo explica. */}
        {Math.abs(efectivoEsperado - Number(contado || 0)) > 0.001 ? (
          <div
            className="rounded-lg px-3.5 py-3"
            style={{ background: 'rgba(245,158,11,.12)' }}
          >
            <p className="text-[13px] font-medium text-warning">
              Contaste <span className="tabular-nums">{soles(Number(contado || 0))}</span>, así que{' '}
              {efectivoEsperado > Number(contado || 0)
                ? `faltan ${soles(efectivoEsperado - Number(contado || 0))}`
                : `sobran ${soles(Number(contado || 0) - efectivoEsperado)}`}
              .
            </p>
            <p className="mt-0.5 mb-2 text-[12px] text-tx-sec">
              Escribe qué pasó. Sin esto no se puede cerrar.
            </p>
            <Campo
              placeholder="Se pagó al gasfitero y no se registró, se devolvió un vuelto de más…"
              value={justificaCaja}
              onChange={(e) => setJustificaCaja(e.target.value)}
            />
          </div>
        ) : (
          <p className="text-[12px] text-success">La caja cuadra.</p>
        )}

        <p className="text-[12px] text-tx-muted">
          Lo que cuentes queda como saldo de la caja para el siguiente turno.
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

/**
 * Registrar un gasto.
 *
 * Un `fijo` es la compra de un producto del catálogo: descuenta de la caja y llena el
 * inventario en la misma operación. Un `justificable` es cualquier otra cosa, y no se
 * puede guardar sin explicar qué fue — la base tampoco lo acepta.
 */
function DialogoGasto({
  categoria,
  productos,
  enCaja,
  onCerrar,
  onHecho,
}: {
  categoria: CategoriaGasto;
  productos: Producto[];
  enCaja: number;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [productoId, setProductoId] = useState(productos[0]?.id ?? '');
  const [cantidad, setCantidad] = useState('1');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  const [justificacion, setJustificacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | undefined>();
  const [enviando, empezar] = useTransition();

  const esFijo = categoria === 'fijo';
  const producto = productos.find((p) => p.id === productoId);
  const referencia =
    producto && producto.costo_referencia > 0
      ? producto.costo_referencia * (Number(cantidad) || 1)
      : null;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await registrarGasto({
        categoria,
        concepto: esFijo ? '' : concepto,
        monto: Number(monto),
        medio,
        producto_id: esFijo ? productoId : null,
        cantidad: esFijo ? Number(cantidad) : null,
        justificacion: esFijo ? null : justificacion,
      });
      if (!r.ok) {
        setError(r.error);
        setCampo(r.campo);
        return;
      }
      onHecho();
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="pop max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-surf-float p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">
              {esFijo ? 'Comprar producto' : 'Otro gasto'}
            </p>
            <p className="mt-0.5 text-[12.5px] text-tx-muted">
              {esFijo
                ? 'Sale de la caja y entra al inventario.'
                : 'Sale de la caja y queda una alerta para revisar.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-8 place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {esFijo ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Producto</span>
                <select
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                  className="w-full rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx"
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · quedan {p.stock} {p.unidad}
                    </option>
                  ))}
                </select>
              </label>

              <Campo
                etiqueta={`Cuántos compraste (${producto?.unidad ?? 'unid.'})`}
                type="number"
                min="1"
                autoFocus
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </>
          ) : (
            <Campo
              etiqueta="En qué se gastó"
              autoFocus
              placeholder="Escobas y recogedor"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              error={campo === 'concepto' ? error ?? undefined : undefined}
            />
          )}

          <Campo
            etiqueta="Cuánto se pagó en total (S/)"
            type="number"
            min="0"
            step="0.10"
            placeholder={referencia ? referencia.toFixed(2) : undefined}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            error={campo === 'monto' ? error ?? undefined : undefined}
          />

          {referencia !== null && (
            <p className="-mt-1 text-[12px] text-tx-muted">
              Al precio de referencia serían {soles(referencia)}. Si se pasa mucho, queda una
              alerta.
            </p>
          )}

          <div>
            <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Cómo se pagó</span>
            <div className="flex flex-wrap gap-2">
              {MEDIOS_PAGO.map((m) => (
                <Pildora key={m} activa={medio === m} onClick={() => setMedio(m)}>
                  {ETIQUETA_MEDIO[m]}
                </Pildora>
              ))}
            </div>
            {medio === 'efectivo' && (
              <p className="mt-1.5 text-[12px] text-tx-muted">
                En la caja hay {soles(enCaja)}. Un gasto en efectivo no puede pasarse de eso.
              </p>
            )}
          </div>

          {!esFijo && (
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">
                Por qué fue necesario
              </span>
              <textarea
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Se rompieron las dos escobas del segundo piso."
                className="w-full resize-none rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx placeholder:text-tx-dis focus:border-brand-500"
              />
              {campo === 'justificacion' && error && (
                <span className="mt-1 block text-[12px] text-danger">{error}</span>
              )}
            </label>
          )}

          {error && !campo && <ErrorCaja mensaje={error} />}

          <div className="mt-1 flex gap-2">
            <Boton type="submit" variante="primario" disabled={enviando} className="flex-[2]">
              {enviando ? 'Guardando…' : 'Registrar gasto'}
            </Boton>
            <Boton type="button" variante="fantasma" onClick={onCerrar} className="flex-1">
              Cancelar
            </Boton>
          </div>
        </div>
      </form>
    </div>
  );
}
