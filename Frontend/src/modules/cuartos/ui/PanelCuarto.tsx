'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as Iconos from 'lucide-react';
import { Boton, Chip, ErrorCaja, soles } from '@/shared/ui/primitivos';
import { esDeCaja } from '@/shared/ui/navegacion';
import type { Rol } from '@/shared/dominio/tipos';
import type { CuartoConTipo, DetalleCuarto, EstadoCuarto } from '../domain/tipos';
import { cambiarEstadoCuarto, detalleCuarto } from '../infrastructure/acciones';
import { registrarCheckout } from '@/modules/estadias/infrastructure/acciones';
import { abrirCheckin } from '@/modules/estadias/ui/CajonCheckin';
import { abrirInspeccion } from '@/modules/estadias/ui/CajonInspeccion';
import { moverStock } from '@/modules/inventario/infrastructure/acciones';
import type { Producto } from '@/modules/inventario/domain/tipos';
import { ESTILO_ESTADO, FLUJO_ESTADOS } from './estados';
import { SIGUIENTE_PASO } from './flujo';

/**
 * Panel lateral de una habitación. Portado de `openRoom()` del prototipo.
 *
 * El mockup enseñaba el bloque de datos con valores inventados («Hoy · 09:40»). Aquí
 * cada dato sale de donde tiene que salir —la estadía activa, el historial de estados,
 * la tabla de reservas— y **lo que no existe se dice**. Un «Hoy · 15:00» falso en la
 * pantalla de recepción es peor que un «sin reservas».
 *
 * Las acciones rápidas del mockup mandaban una frase al asistente. Aquí ejecutan de
 * verdad, salvo las que necesitan más datos, que abren la pantalla que corresponde.
 */

function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const C = (Iconos as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nombre];
  return C ? <C className={className} /> : null;
}

const ICONO_ESTADO: Record<EstadoCuarto, string> = {
  libre: 'BedDouble',
  ocupada: 'User',
  checkout: 'LogOut',
  limpieza: 'BrushCleaning',
  inspeccion: 'ClipboardList',
  lista: 'CircleCheck',
  mantenimiento: 'Wrench',
};

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-tx-muted">{titulo}</p>
      <p className="mt-0.5 text-[13px] font-medium">{children}</p>
    </div>
  );
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function soloFecha(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function PanelCuarto({
  cuarto,
  rol,
  productos,
  onCerrar,
}: {
  cuarto: CuartoConTipo;
  rol: Rol;
  /** Para resolver los insumos de las acciones rápidas sin otro viaje. */
  productos: Producto[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetalleCuarto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const manejaDinero = esDeCaja(rol);
  const e = ESTILO_ESTADO[cuarto.estado];
  const paso = SIGUIENTE_PASO[cuarto.estado];

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const r = await detalleCuarto(cuarto.id);
      if (!vigente) return;
      if (r.ok) setDetalle(r.datos);
      else setError(r.error);
    })();
    return () => {
      vigente = false;
    };
  }, [cuarto.id]);

  function hacer(accion: () => Promise<{ ok: boolean; error?: string }>, cerrar = false) {
    setError(null);
    empezar(async () => {
      const r = await accion();
      if (!r.ok) {
        setError(r.error ?? 'No se pudo completar.');
        return;
      }
      router.refresh();
      if (cerrar) onCerrar();
    });
  }

  const cambiar = (estado: EstadoCuarto) =>
    hacer(() => cambiarEstadoCuarto({ cuarto_id: cuarto.id, estado }), true);

  /**
   * Entrega directa de un insumo, sin cobrar. Es la acción rápida del mockup.
   *
   * El producto se busca por nombre en el catálogo del hostal: si este no vende toallas
   * con ese nombre, el botón ni se pinta. Mejor que un botón que falla.
   */
  const insumo = (nombre: string) => productos.find((x) => x.nombre === nombre) ?? null;

  const entregar = (producto: Producto) =>
    hacer(() =>
      moverStock({
        tipo: 'entrega',
        producto_id: producto.id,
        cantidad: 1,
        cuarto_id: cuarto.id,
      })
    );

  const toalla = insumo('Toallas');
  const papel = insumo('Papel higiénico');

  const checkout = () => {
    if (!detalle?.estadia) return;
    hacer(() => registrarCheckout(detalle.estadia!.id), true);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onCerrar}>
      <aside
        className="up flex h-full w-full max-w-md flex-col overflow-y-auto bg-surf-float shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-label={`Habitación ${cuarto.numero}`}
      >
        {/* Cabecera pegajosa, como el `dHead` del mockup. */}
        <div className="glass sticky top-0 z-10 flex h-14 items-center gap-3 hair-b px-4 backdrop-blur">
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 place-items-center rounded-md text-tx-sec hover:bg-surf-hover cursor-pointer"
          >
            <Iconos.X className="size-[18px]" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight">
              Habitación {cuarto.numero}
            </p>
            <p className="text-[12px] text-tx-muted">{cuarto.tipo}</p>
          </div>
          <div className="ml-auto">
            <Chip tono="muted">
              <span style={{ color: e.color }}>{e.etiqueta}</span>
            </Chip>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {cuarto.nota && (
            <p className="flex items-center gap-2.5 rounded-lg bg-bg-ter hair px-4 py-3 text-[13px] text-tx-sec">
              <span className="size-2 shrink-0 rounded-full" style={{ background: e.color }} />
              {cuarto.nota}
            </p>
          )}

          {/* Bloque 2×2 del mockup, con datos reales. */}
          <div className="rounded-lg bg-surf hair p-4">
            {!detalle ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="sk h-9 rounded-md" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Dato titulo="Huésped / personas">
                  {detalle.estadia?.huespedes
                    ? `${detalle.estadia.huespedes.nombre} · ${detalle.estadia.personas} pers.`
                    : 'Sin huésped'}
                </Dato>

                <Dato titulo="Próxima reserva">
                  {detalle.proxima_reserva
                    ? `${soloFecha(detalle.proxima_reserva.fecha_entrada)} · ${detalle.proxima_reserva.nombre_contacto ?? 'sin nombre'}`
                    : 'Sin reservas'}
                </Dato>

                <Dato titulo="Aforo y tarifa">
                  {cuarto.aforo} pers. · {soles(detalle.tipos_cuarto?.amanecida ?? 0)}/noche
                </Dato>

                <Dato titulo="Última limpieza">
                  {detalle.ultima_limpieza
                    ? `${fechaCorta(detalle.ultima_limpieza.created_at)}${
                        detalle.ultima_limpieza.profiles?.nombre
                          ? ` · ${detalle.ultima_limpieza.profiles.nombre}`
                          : ''
                      }`
                    : 'Sin registro'}
                </Dato>
              </div>
            )}

            {detalle?.estadia && (
              <p className="mt-3 hair-t pt-3 text-[12.5px] text-tx-muted">
                Entró el {soloFecha(detalle.estadia.fecha_entrada)}
                {detalle.estadia.fecha_salida && ` · sale el ${soloFecha(detalle.estadia.fecha_salida)}`}
                {' · '}
                <span className="text-tx-sec">{soles(detalle.estadia.tarifa_total)}</span>
              </p>
            )}
          </div>

          {cuarto.caracteristicas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cuarto.caracteristicas.map((c) => (
                <Chip key={c} tono="brand">
                  {c.replace(/_/g, ' ')}
                </Chip>
              ))}
            </div>
          )}

          {error && <ErrorCaja mensaje={error} />}

          {/* Cambiar estado: píldoras con icono, en fila, como el mockup. */}
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-tx-muted">
              Cambiar estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FLUJO_ESTADOS.map((k) => {
                const st = ESTILO_ESTADO[k];
                const actual = cuarto.estado === k;
                return (
                  <button
                    key={k}
                    onClick={() => cambiar(k)}
                    disabled={actual || ocupado}
                    aria-pressed={actual}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer disabled:cursor-default"
                    style={
                      actual
                        ? { background: st.fondo, color: st.color, border: `1px solid ${st.color}` }
                        : {
                            background: 'var(--raised)',
                            border: '1px solid var(--line)',
                            color: 'var(--tx-sec)',
                          }
                    }
                  >
                    <Icono nombre={ICONO_ESTADO[k]} className="size-3.5" />
                    {st.etiqueta}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-tx-muted">
              Recepción y limpieza pueden actualizarlo. Queda registrado en el historial.
            </p>
          </div>

          {/* Acciones rápidas: las seis del mockup, ejecutando de verdad. */}
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-tx-muted">
              Acciones rápidas
            </p>
            <div className="grid grid-cols-2 gap-2">
              {manejaDinero && (
                <AccionRapida
                  icono="ShoppingCart"
                  etiqueta="Vender producto"
                  disabled={ocupado}
                  onClick={() => router.push('/inventario')}
                />
              )}
              {toalla && (
                <AccionRapida
                  icono="CirclePlus"
                  etiqueta="Agregar toalla"
                  disabled={ocupado}
                  onClick={() => entregar(toalla)}
                />
              )}
              {papel && (
                <AccionRapida
                  icono="ScrollText"
                  etiqueta="Reponer papel"
                  disabled={ocupado}
                  onClick={() => entregar(papel)}
                />
              )}
              {manejaDinero && (
                <AccionRapida
                  icono="ClipboardList"
                  etiqueta="Iniciar inspección"
                  disabled={ocupado}
                  onClick={() => {
                    onCerrar();
                    abrirInspeccion(cuarto.id);
                  }}
                />
              )}
              <AccionRapida
                icono="TriangleAlert"
                etiqueta="Reportar daño"
                disabled={ocupado}
                onClick={() => router.push(`/asistente?texto=${encodeURIComponent(`Reportar daño en la ${cuarto.numero}`)}`)}
              />
              {paso && (
                <AccionRapida
                  icono={paso.icono}
                  etiqueta={paso.verbo}
                  disabled={ocupado}
                  onClick={() => cambiar(paso.estado)}
                />
              )}
            </div>
          </div>

          {/* El botón principal depende de en qué punto está la habitación. */}
          {manejaDinero && (cuarto.estado === 'libre' || cuarto.estado === 'lista') && (
            <Boton
              variante="primario"
              className="h-11 w-full"
              onClick={() => {
                onCerrar();
                abrirCheckin();
              }}
            >
              <Iconos.LogIn className="size-4" />
              Hacer check-in
            </Boton>
          )}

          {manejaDinero && cuarto.estado === 'ocupada' && (
            <Boton
              variante="primario"
              className="h-11 w-full"
              disabled={ocupado || !detalle?.estadia}
              onClick={checkout}
            >
              <Iconos.LogOut className="size-4" />
              {ocupado ? 'Registrando…' : 'Registrar check-out'}
            </Boton>
          )}

          {manejaDinero && cuarto.estado === 'ocupada' && (
            <p className="-mt-2 text-center text-[11.5px] text-tx-muted">
              El check-out deja el cuarto en «Check-out», no en disponible: antes van
              inspección y limpieza.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function AccionRapida({
  icono,
  etiqueta,
  disabled,
  onClick,
}: {
  icono: string;
  etiqueta: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 items-center gap-2 rounded-md bg-surf hair px-3 text-left text-[13px] font-medium transition-colors hover:bg-surf-hover cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Icono nombre={icono} className="size-4 shrink-0 text-brand-500" />
      {etiqueta}
    </button>
  );
}
