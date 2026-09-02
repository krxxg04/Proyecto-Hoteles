'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Producto } from '../domain/tipos';
import { desactivarProducto, guardarProducto } from '../infrastructure/acciones';
import { Boton, Campo, Chip, ErrorCaja, Pildora, soles } from '@/shared/ui/primitivos';
import { Celda, EncabezadoSeccion, Fila, Tabla } from '@/shared/ui/tabla';

/** Catálogo. El stock no se edita aquí: solo se mueve con movimientos registrados. */
export function VistaProductosAdmin({ productos }: { productos: Producto[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function darDeBaja(p: Producto) {
    setError(null);
    empezar(async () => {
      const r = await desactivarProducto(p.id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoSeccion
        titulo="Productos"
        subtitulo="Insumos del hostal y artículos vendibles"
        accion={
          <Boton variante="primario" onClick={() => setCreando(true)}>
            <Plus className="size-4" />
            Nuevo producto
          </Boton>
        }
      />

      {error && <ErrorCaja mensaje={error} />}

      <Tabla columnas={['Producto', 'Categoría', 'Clase', 'Stock', 'Avisar bajo', 'Costo compra', 'Precio venta', '']}>
        {productos.map((p) => (
          <Fila key={p.id}>
            <Celda className="font-medium">{p.nombre}</Celda>
            <Celda>
              {p.categoria === 'vendible' ? (
                <Chip tono="brand">Vendible</Chip>
              ) : (
                <span className="text-[12px] text-tx-muted">Insumo</span>
              )}
            </Celda>
            <Celda className="text-[12px]" oculta="md">
              {p.clase === 'no_descartable' ? (
                <span className="text-tx-sec">No descartable</span>
              ) : (
                <span className="text-tx-muted">Descartable</span>
              )}
            </Celda>
            <Celda className="tabular-nums text-tx-sec" oculta="sm">
              {p.stock} / {p.stock_max} {p.unidad}
            </Celda>
            <Celda className="tabular-nums" oculta="sm">
              {p.stock_min > 0 ? (
                <span className={p.stock <= p.stock_min ? 'text-danger' : 'text-tx-sec'}>
                  {p.stock_min} {p.unidad}
                </span>
              ) : (
                <span className="text-tx-dis">sin aviso</span>
              )}
            </Celda>
            <Celda className="tabular-nums" oculta="md">
              {p.costo_referencia > 0 ? (
                <span className="text-tx-sec">{soles(p.costo_referencia)}</span>
              ) : (
                <span className="text-tx-dis">sin control</span>
              )}
            </Celda>
            <Celda className="tabular-nums text-tx-sec">
              {p.categoria === 'vendible' ? soles(p.precio) : '—'}
            </Celda>
            <Celda className="text-right">
              <div className="flex justify-end gap-1">
                <button type="button"
                  onClick={() => setEditando(p)}
                  aria-label={`Editar ${p.nombre}`}
                  className="grid size-8 cursor-pointer place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx"
                >
                  <Pencil className="size-4" />
                </button>
                <button type="button"
                  onClick={() => darDeBaja(p)}
                  disabled={ocupado}
                  aria-label={`Dar de baja ${p.nombre}`}
                  className="grid size-8 cursor-pointer place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </Celda>
          </Fila>
        ))}
      </Tabla>

      <p className="text-[12px] text-tx-muted">
        El stock nace en cero y solo se mueve con compras, entregas o ajustes, para que el conteo de
        cierre cuadre contra algo real.
      </p>

      {(creando || editando) && (
        <DialogoProducto
          producto={editando}
          onCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
          onHecho={() => {
            setCreando(false);
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DialogoProducto({
  producto,
  onCerrar,
  onHecho,
}: {
  producto?: Producto | null;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [unidad, setUnidad] = useState(producto?.unidad ?? 'unid.');
  const [stockMax, setStockMax] = useState(String(producto?.stock_max ?? 50));
  const [stockMin, setStockMin] = useState(String(producto?.stock_min ?? 0));
  const [categoria, setCategoria] = useState<'insumo' | 'vendible'>(producto?.categoria ?? 'vendible');
  const [clase, setClase] = useState<'descartable' | 'no_descartable'>(
    producto?.clase ?? 'descartable'
  );
  const [precio, setPrecio] = useState(String(producto?.precio ?? 0));
  const [costoRef, setCostoRef] = useState(String(producto?.costo_referencia ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | undefined>();
  const [enviando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await guardarProducto({
        id: producto?.id,
        nombre,
        unidad,
        stock_max: Number(stockMax),
        stock_min: Number(stockMin),
        categoria,
        clase,
        precio: Number(precio),
        costo_referencia: Number(costoRef),
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
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="pop w-full max-w-sm rounded-xl bg-surf-float p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-[16px] font-semibold">{producto ? `Editar ${producto.nombre}` : 'Nuevo producto'}</p>
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
            etiqueta="Nombre"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={campo === 'nombre' ? error ?? undefined : undefined}
          />

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} />
            <Campo
              etiqueta="Stock máximo"
              type="number"
              min="1"
              value={stockMax}
              onChange={(e) => setStockMax(e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-surf hair p-3">
            <Campo
              etiqueta="Avisar cuando queden menos de"
              type="number"
              min="0"
              value={stockMin}
              onChange={(e) => setStockMin(e.target.value)}
              error={campo === 'stock_min' ? error ?? undefined : undefined}
            />
            <p className="mt-1.5 text-[12px] text-tx-muted">
              Con cuánto todavía da tiempo a reponer. Sale en Alertas al llegar, y en ámbar un poco
              antes. 0 = sin aviso.
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Categoría</span>
            <div className="flex gap-2">
              <Pildora activa={categoria === 'vendible'} onClick={() => setCategoria('vendible')}>
                Vendible
              </Pildora>
              <Pildora activa={categoria === 'insumo'} onClick={() => setCategoria('insumo')}>
                Insumo
              </Pildora>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Clase</span>
            <div className="flex gap-2">
              <Pildora activa={clase === 'descartable'} onClick={() => setClase('descartable')}>
                Descartable
              </Pildora>
              <Pildora activa={clase === 'no_descartable'} onClick={() => setClase('no_descartable')}>
                No descartable
              </Pildora>
            </div>
          </div>

          {categoria === 'vendible' && (
            <Campo
              etiqueta="Precio (S/)"
              type="number"
              step="0.10"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              error={campo === 'precio' ? error ?? undefined : undefined}
            />
          )}

          <div className="rounded-lg bg-surf hair p-3">
            <Campo
              etiqueta="Cuánto cuesta comprar una unidad (S/)"
              type="number"
              step="0.10"
              min="0"
              value={costoRef}
              onChange={(e) => setCostoRef(e.target.value)}
              error={campo === 'costo_referencia' ? error ?? undefined : undefined}
            />
            <p className="mt-1.5 text-[12px] text-tx-muted">
              Lo que suele pagarse al proveedor. Si una compra se pasa mucho de aquí, queda una
              alerta. 0 = sin control de precio.
            </p>
          </div>

          {error && !campo && <ErrorCaja mensaje={error} />}

          <div className="mt-1 flex gap-2">
            <Boton type="submit" variante="primario" disabled={enviando} className="flex-1">
              {enviando ? 'Guardando…' : 'Guardar'}
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
