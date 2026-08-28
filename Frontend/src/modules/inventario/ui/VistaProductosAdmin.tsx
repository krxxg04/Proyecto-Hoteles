'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { Producto } from '../domain/tipos';
import { guardarProducto } from '../infrastructure/acciones';
import { Boton, Campo, Chip, ErrorCaja, Pildora, soles } from '@/shared/ui/primitivos';
import { Celda, EncabezadoSeccion, Fila, Tabla } from '@/shared/ui/tabla';

/** Catálogo. El stock no se edita aquí: solo se mueve con movimientos registrados. */
export function VistaProductosAdmin({ productos }: { productos: Producto[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);

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

      <Tabla columnas={['Producto', 'Categoría', 'Clase', 'Stock', 'Precio']}>
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
            <Celda className="tabular-nums text-tx-sec">
              {p.categoria === 'vendible' ? soles(p.precio) : '—'}
            </Celda>
          </Fila>
        ))}
      </Tabla>

      <p className="text-[12px] text-tx-muted">
        El stock nace en cero y solo se mueve con compras, entregas o ajustes, para que el conteo de
        cierre cuadre contra algo real.
      </p>

      {creando && (
        <DialogoProducto
          onCerrar={() => setCreando(false)}
          onHecho={() => {
            setCreando(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DialogoProducto({ onCerrar, onHecho }: { onCerrar: () => void; onHecho: () => void }) {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('unid.');
  const [stockMax, setStockMax] = useState('50');
  const [categoria, setCategoria] = useState<'insumo' | 'vendible'>('vendible');
  const [clase, setClase] = useState<'descartable' | 'no_descartable'>('descartable');
  const [precio, setPrecio] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | undefined>();
  const [enviando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await guardarProducto({
        nombre,
        unidad,
        stock_max: Number(stockMax),
        categoria,
        clase,
        precio: Number(precio),
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
          <p className="text-[16px] font-semibold">Nuevo producto</p>
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
