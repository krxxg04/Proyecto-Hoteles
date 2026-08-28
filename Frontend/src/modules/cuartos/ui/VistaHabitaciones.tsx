'use client';

import { useState } from 'react';
import type { CuartoConTipo, EstadoCuarto } from '../domain/tipos';
import { ESTILO_ESTADO, FLUJO_ESTADOS } from './estados';
import { Chip, Pildora, Vacio } from '@/shared/ui/primitivos';
import { PanelCuarto } from './PanelCuarto';
import type { Producto } from '@/modules/inventario/domain/tipos';
import type { Rol } from '@/shared/dominio/tipos';
import { useEnVivo } from '@/shared/ui/useEnVivo';
import { PuntoEnVivo } from '@/shared/ui/PuntoEnVivo';

/** Rejilla con filtros tipo píldora. El detalle y las acciones viven en `PanelCuarto`. */

function TarjetaCuarto({ cuarto, onClick }: { cuarto: CuartoConTipo; onClick: () => void }) {
  const e = ESTILO_ESTADO[cuarto.estado];
  return (
    <button
      onClick={onClick}
      className="card relative overflow-hidden rounded-xl bg-surf hair p-4 text-left transition-transform hover:-translate-y-0.5 hover:bg-surf-hover cursor-pointer"
    >
      <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: e.color }} />
      <div className="mb-1.5 flex items-center justify-between gap-2 pl-1.5">
        <span className="text-[20px] font-bold leading-none tracking-tight">{cuarto.numero}</span>
        <Chip tono="muted">
          <span style={{ color: e.color }}>{e.etiqueta}</span>
        </Chip>
      </div>
      <p className="pl-1.5 text-[12px] text-tx-muted">{cuarto.tipo}</p>
      <p className="mt-0.5 truncate pl-1.5 text-[13px] text-tx-sec">
        {cuarto.nota || `Aforo ${cuarto.aforo}`}
      </p>
    </button>
  );
}

export function VistaHabitaciones({
  cuartos,
  rol,
  productos,
}: {
  cuartos: CuartoConTipo[];
  rol: Rol;
  productos: Producto[];
}) {
  const [filtro, setFiltro] = useState<EstadoCuarto | 'todas'>('todas');
  const [abierto, setAbierto] = useState<CuartoConTipo | null>(null);

  // Recepción y limpieza miran esta misma pantalla a la vez.
  const enVivo = useEnVivo('cuartos');

  const conteo = cuartos.reduce<Record<string, number>>((acc, c) => {
    acc[c.estado] = (acc[c.estado] ?? 0) + 1;
    return acc;
  }, {});

  const visibles = filtro === 'todas' ? cuartos : cuartos.filter((c) => c.estado === filtro);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pildora activa={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas ({cuartos.length})
        </Pildora>
        {FLUJO_ESTADOS.filter((e) => conteo[e]).map((e) => (
          <Pildora key={e} activa={filtro === e} onClick={() => setFiltro(e)}>
            {ESTILO_ESTADO[e].etiqueta} ({conteo[e]})
          </Pildora>
        ))}
        <span className="ml-auto">
          <PuntoEnVivo estado={enVivo} />
        </span>
      </div>

      {visibles.length === 0 ? (
        <Vacio titulo="No hay habitaciones en ese estado" detalle="Prueba con otro filtro." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibles.map((c) => (
            <TarjetaCuarto key={c.id} cuarto={c} onClick={() => setAbierto(c)} />
          ))}
        </div>
      )}

      {abierto && (
        <PanelCuarto
          cuarto={abierto}
          rol={rol}
          productos={productos}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  );
}
