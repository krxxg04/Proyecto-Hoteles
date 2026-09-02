'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Package, ShoppingCart, WashingMachine, Plus, X } from 'lucide-react';
import type { Producto } from '../domain/tipos';
import type { CuartoConTipo } from '@/modules/cuartos/domain/tipos';
import { moverStock, venderProducto, enviarAAseo } from '../infrastructure/acciones';
import { registrarGasto } from '@/modules/caja/infrastructure/acciones';
import { MEDIOS_PAGO, ETIQUETA_MEDIO, type MedioPago, type Rol } from '@/shared/dominio/tipos';
import { esDeCaja } from '@/shared/ui/navegacion';
import { Boton, Campo, ErrorCaja, Pildora, Vacio, soles } from '@/shared/ui/primitivos';

/** Niveles con barra y días de cobertura, como la vista Inventario del mockup. */

const TONO = { danger: '#EF4444', warning: '#F59E0B', success: '#22C55E' } as const;
const FONDO = {
  danger: 'rgba(239,68,68,.14)',
  warning: 'rgba(245,158,11,.14)',
  success: 'rgba(34,197,94,.14)',
} as const;

type Dialogo =
  | { tipo: 'vender'; producto: Producto }
  | { tipo: 'compra'; producto: Producto }
  | { tipo: 'entrega'; producto: Producto }
  | null;

export function VistaInventario({
  productos,
  cuartos,
  rol,
}: {
  productos: Producto[];
  cuartos: CuartoConTipo[];
  rol: Rol;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<'todos' | 'vendible' | 'insumo' | 'critico'>('todos');
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  const visibles = productos.filter((p) => {
    if (filtro === 'critico') return p.bajoMinimo || p.semaforo === 'danger';
    if (filtro === 'todos') return true;
    return p.categoria === filtro;
  });

  const criticos = productos.filter((p) => p.bajoMinimo || p.semaforo === 'danger').length;

  /**
   * Comprar y vender mueven dinero; entregar y mandar a lavandería, no.
   *
   * `08_acciones_por_rol.sql` ya rechaza la compra en la base para limpieza y
   * mantenimiento. Esconder el botón es solo no ofrecer algo que iba a fallar.
   */
  const manejaDinero = esDeCaja(rol);

  function aseo(p: Producto) {
    setError(null);
    empezar(async () => {
      const r = await enviarAAseo(p.id, 1);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Pildora activa={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos ({productos.length})
        </Pildora>
        <Pildora activa={filtro === 'vendible'} onClick={() => setFiltro('vendible')}>
          Vendibles ({productos.filter((p) => p.categoria === 'vendible').length})
        </Pildora>
        <Pildora activa={filtro === 'insumo'} onClick={() => setFiltro('insumo')}>
          Insumos ({productos.filter((p) => p.categoria === 'insumo').length})
        </Pildora>
        {criticos > 0 && (
          <Pildora activa={filtro === 'critico'} onClick={() => setFiltro('critico')}>
            Por reponer ({criticos})
          </Pildora>
        )}
      </div>

      {error && <ErrorCaja mensaje={error} />}

      {visibles.length === 0 ? (
        <Vacio titulo="No hay productos aquí" detalle="Prueba con otro filtro." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((p) => {
            const color = TONO[p.semaforo];
            return (
              <div key={p.id} className="card rounded-lg bg-surf hair p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="grid size-9 shrink-0 place-items-center rounded-md"
                    style={{ background: FONDO[p.semaforo] }}
                  >
                    <Package className="size-[18px]" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold">{p.nombre}</p>
                    <p className="text-[12px] text-tx-muted">
                      {p.stock} {p.unidad}
                      {p.dias !== null && (
                        <>
                          {' · '}
                          <span style={{ color }}>~{p.dias} días</span>
                        </>
                      )}
                    </p>
                    {p.stock_min > 0 && (
                      <p className="text-[11.5px]" style={{ color: p.bajoMinimo ? color : undefined }}>
                        {p.bajoMinimo
                          ? `Reponer: el mínimo son ${p.stock_min}`
                          : `Mínimo ${p.stock_min} ${p.unidad}`}
                      </p>
                    )}
                  </div>
                  <span className="ml-auto text-[13px] font-semibold tabular-nums text-tx-sec">
                    {p.nivel}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-bg-ter">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, p.nivel)}%`, background: color }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Boton
                    variante="secundario"
                    className="h-8 flex-1"
                    onClick={() => setDialogo({ tipo: 'entrega', producto: p })}
                  >
                    Entregar
                  </Boton>
                  {manejaDinero && (
                    <Boton
                      variante="fantasma"
                      className="h-8"
                      onClick={() => setDialogo({ tipo: 'compra', producto: p })}
                    >
                      <Plus className="size-3.5" />
                      Comprar
                    </Boton>
                  )}
                  {manejaDinero && p.categoria === 'vendible' && (
                    <button type="button"
                      onClick={() => setDialogo({ tipo: 'vender', producto: p })}
                      className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-3 text-[12.5px] font-medium"
                      style={{ color: '#7C4DFF', background: 'rgba(124,77,255,.12)' }}
                    >
                      <ShoppingCart className="size-3.5" />
                      Vender
                    </button>
                  )}
                  {p.clase === 'no_descartable' && (
                    <Boton variante="fantasma" className="h-8" disabled={enviando} onClick={() => aseo(p)}>
                      <WashingMachine className="size-3.5" />
                      Aseo
                    </Boton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialogo && (
        <DialogoMovimiento
          dialogo={dialogo}
          cuartos={cuartos}
          onCerrar={() => setDialogo(null)}
          onHecho={() => {
            setDialogo(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DialogoMovimiento({
  dialogo,
  cuartos,
  onCerrar,
  onHecho,
}: {
  dialogo: NonNullable<Dialogo>;
  cuartos: CuartoConTipo[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const { tipo, producto } = dialogo;
  const [cantidad, setCantidad] = useState('1');
  const [cuartoId, setCuartoId] = useState(cuartos[0]?.id ?? '');
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  const [banco, setBanco] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  const [monto, setMonto] = useState('');

  const titulo = { vender: 'Vender', compra: 'Comprar', entrega: 'Entregar a habitación' }[tipo];

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const n = Number(cantidad);
      const r =
        tipo === 'vender'
          ? await venderProducto({
              producto_id: producto.id,
              cantidad: n,
              cuarto_id: cuartoId || null,
              medio,
              banco: medio === 'tarjeta' ? banco : undefined,
            })
          : tipo === 'compra'
            ? // Comprar es un gasto fijo: sale de la caja y entra al inventario de una vez.
              await registrarGasto({
                categoria: 'fijo',
                producto_id: producto.id,
                cantidad: n,
                monto: Number(monto),
                medio,
              })
            : await moverStock({
                tipo: 'entrega',
                producto_id: producto.id,
                cantidad: n,
                cuarto_id: cuartoId,
              });

      if (!r.ok) setError(r.error);
      else onHecho();
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="pop w-full max-w-sm rounded-xl bg-surf-float p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">{titulo}</p>
            <p className="mt-0.5 text-[13px] text-tx-sec">{producto.nombre}</p>
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
          <Campo
            etiqueta={`Cantidad (${producto.unidad})`}
            type="number"
            min="1"
            step="1"
            autoFocus
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />

          {tipo === 'compra' && (
            <>
              <Campo
                etiqueta="Cuánto se pagó en total (S/)"
                type="number"
                min="0"
                step="0.10"
                placeholder={
                  producto.costo_referencia > 0
                    ? (producto.costo_referencia * (Number(cantidad) || 1)).toFixed(2)
                    : undefined
                }
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <p className="-mt-1 text-[12px] text-tx-muted">
                Sale de la caja. Si se pasa mucho del precio de referencia, queda una alerta.
              </p>
            </>
          )}

          {(tipo === 'entrega' || tipo === 'vender') && (
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">
                Habitación {tipo === 'vender' && <span className="text-tx-muted">(opcional)</span>}
              </span>
              <select
                value={cuartoId}
                onChange={(e) => setCuartoId(e.target.value)}
                className="w-full rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx"
              >
                {tipo === 'vender' && <option value="">Sin habitación</option>}
                {cuartos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.tipo}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(tipo === 'vender' || tipo === 'compra') && (
            <>
              <div>
                <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">
                  {tipo === 'compra' ? 'Cómo se pagó' : 'Cómo paga'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {MEDIOS_PAGO.map((m) => (
                    <Pildora key={m} activa={medio === m} onClick={() => setMedio(m)}>
                      {ETIQUETA_MEDIO[m]}
                    </Pildora>
                  ))}
                </div>
              </div>
              {medio === 'tarjeta' && (
                <Campo
                  etiqueta="Banco"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="BCP, BBVA…"
                />
              )}
              {/* Solo al vender: en una compra el monto lo pone quien pagó, no el catálogo. */}
              {tipo === 'vender' && (
                <p className="rounded-md bg-bg-ter px-3 py-2 text-[12.5px] text-tx-muted">
                  Se cobrará {soles(producto.precio * (Number(cantidad) || 0))}. El precio lo calcula
                  el servidor desde el catálogo.
                </p>
              )}
            </>
          )}

          {error && <ErrorCaja mensaje={error} />}

          <div className="mt-1 flex gap-2">
            <Boton type="submit" variante="primario" disabled={enviando} className="flex-1">
              {enviando ? 'Guardando…' : 'Confirmar'}
            </Boton>
            <Boton type="button" variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
          </div>
        </div>
      </form>
    </div>
  );
}
