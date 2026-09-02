'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, PackageOpen, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { Alerta, Incidencia } from '../domain/tipos';
import type { ProductoEnAviso } from '@/modules/reportes/domain/tipos';
import { atenderAlerta, revisarIncidencia } from '../infrastructure/acciones';
import { Boton, Card, Chip, ErrorCaja, Pildora, Vacio } from '@/shared/ui/primitivos';
import { EncabezadoSeccion } from '@/shared/ui/tabla';
import { fechaYHora } from '@/shared/ui/fechas';

const TONO_SEVERIDAD = { info: 'info', warning: 'warning', danger: 'danger' } as const;

/**
 * Descuadres del cierre de turno.
 *
 * "Revisada" significa que una persona la miró y decidió, no que el sistema la resolviera.
 * Nunca se acusa a nadie automáticamente — es regla de producto, no detalle de implementación.
 */
/**
 * Stock que tocó su mínimo. Va arriba porque se arregla comprando, hoy, antes de que falte.
 *
 * Los días de cobertura solo salen si acompañan al aviso. Decir «reponer» y a la vez «da para
 * ~105 días» es contradecirse en la misma línea: manda el mínimo, que lo puso una persona,
 * y el resto es una estimación que ahí no ayuda.
 */
const DIAS_QUE_APREMIAN = 30;

function AvisosDeStock({ productos }: { productos: ProductoEnAviso[] }) {
  if (productos.length === 0) return null;

  return (
    <section>
      <EncabezadoSeccion
        titulo="Stock por reponer"
        subtitulo={
          productos.length === 1
            ? '1 producto llegó a su mínimo'
            : `${productos.length} productos llegaron a su mínimo`
        }
      />
      <div className="flex flex-col gap-2">
        {productos.map((p) => (
          <Card key={p.nombre}>
            <div className="flex items-center gap-3">
              <div
                className="grid size-9 shrink-0 place-items-center rounded-lg"
                style={{ background: 'rgba(239,68,68,.14)' }}
              >
                <PackageOpen className="size-[18px]" style={{ color: '#EF4444' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{p.nombre}</p>
                <p className="text-[12.5px] text-tx-muted">
                  Quedan{' '}
                  <strong className="tabular-nums text-danger">
                    {p.stock} {p.unidad}
                  </strong>{' '}
                  · el mínimo son {p.stock_min}
                  {p.dias !== null && p.dias <= DIAS_QUE_APREMIAN && ` · da para ~${p.dias} días`}
                </p>
              </div>
              <Chip tono="danger">Reponer</Chip>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/**
 * Las alertas del sistema: gastos fuera de lo habitual, sobreprecios y cajas que no cuadran.
 *
 * La tabla `alertas` existía desde el primer esquema y nadie la leía: `cerrar_turno`
 * escribía en ella y ahí se quedaba. Aquí se ve por primera vez.
 */
function AlertasDelSistema({
  alertas,
  onAtender,
  ocupado,
}: {
  alertas: Alerta[];
  onAtender: (id: string) => void;
  ocupado: boolean;
}) {
  if (alertas.length === 0) return null;

  return (
    <section>
      <EncabezadoSeccion
        titulo="Requieren tu revisión"
        subtitulo={
          alertas.length === 1
            ? '1 movimiento se salió de lo normal'
            : `${alertas.length} movimientos se salieron de lo normal`
        }
      />
      <div className="flex flex-col gap-2">
        {alertas.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start gap-3">
              <ShieldAlert
                className="mt-0.5 size-[18px] shrink-0"
                style={{ color: a.severidad === 'danger' ? '#EF4444' : '#F59E0B' }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold">{a.titulo}</p>
                  <Chip tono={TONO_SEVERIDAD[a.severidad]}>
                    {a.origen === 'caja' ? 'caja' : a.origen ?? 'sistema'}
                  </Chip>
                </div>
                {a.detalle && (
                  <p className="mt-1.5 rounded-md bg-bg-ter px-3 py-2 text-[12.5px] text-tx-sec">
                    {a.detalle}
                  </p>
                )}
                <p className="mt-1.5 text-[11.5px] text-tx-muted">{fechaYHora(a.created_at)}</p>
              </div>
              <Boton variante="secundario" disabled={ocupado} onClick={() => onAtender(a.id)}>
                <Check className="size-4" />
                Revisada
              </Boton>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function VistaIncidencias({
  incidencias,
  bajoMinimo = [],
  alertas = [],
}: {
  incidencias: Incidencia[];
  bajoMinimo?: ProductoEnAviso[];
  alertas?: Alerta[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<'abiertas' | 'todas'>('abiertas');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const visibles =
    filtro === 'abiertas' ? incidencias.filter((i) => i.estado === 'abierta') : incidencias;

  function revisar(id: string) {
    setError(null);
    empezar(async () => {
      const r = await revisarIncidencia(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function atender(id: string) {
    setError(null);
    empezar(async () => {
      const r = await atenderAlerta(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <AlertasDelSistema alertas={alertas} onAtender={atender} ocupado={ocupado} />
      <AvisosDeStock productos={bajoMinimo} />

      <section className="flex flex-col gap-4">
      <EncabezadoSeccion
        titulo="Incidencias"
        subtitulo="Descuadres registrados al cerrar turno"
      />

      <div className="flex gap-2">
        <Pildora activa={filtro === 'abiertas'} onClick={() => setFiltro('abiertas')}>
          Sin revisar ({incidencias.filter((i) => i.estado === 'abierta').length})
        </Pildora>
        <Pildora activa={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas ({incidencias.length})
        </Pildora>
      </div>

      {error && <ErrorCaja mensaje={error} />}

      {visibles.length === 0 ? (
        <Vacio
          titulo={filtro === 'abiertas' ? 'Nada pendiente de revisar' : 'Sin incidencias'}
          detalle="Las incidencias se crean solas cuando un conteo de cierre no cuadra."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.map((i) => {
            const falta = i.diferencia > 0;
            return (
              <Card key={i.id}>
                <div className="flex items-start gap-3">
                  <div
                    className="grid size-9 shrink-0 place-items-center rounded-md"
                    style={{ background: 'rgba(245,158,11,.14)' }}
                  >
                    <TriangleAlert className="size-[18px] text-warning" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold">{i.concepto}</p>
                      <Chip tono={i.estado === 'abierta' ? 'warning' : 'success'}>
                        {i.estado === 'abierta' ? 'Sin revisar' : 'Revisada'}
                      </Chip>
                    </div>

                    <p className="mt-1 text-[13px] text-tx-sec tabular-nums">
                      Esperado {i.esperado} · contado {i.contado} ·{' '}
                      <strong style={{ color: falta ? '#EF4444' : '#3B82F6' }}>
                        {falta ? 'faltan' : 'sobran'} {Math.abs(i.diferencia)} {i.unidad}
                      </strong>
                    </p>

                    <p className="mt-2 rounded-md bg-bg-ter px-3 py-2 text-[12.5px] text-tx-sec">
                      {i.justificacion}
                    </p>

                    <p className="mt-2 text-[11.5px] text-tx-muted">
                      {fechaYHora(i.created_at)}
                    </p>
                  </div>

                  {i.estado === 'abierta' && (
                    <Boton variante="secundario" disabled={ocupado} onClick={() => revisar(i.id)}>
                      <Check className="size-4" />
                      Revisada
                    </Boton>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </section>
    </div>
  );
}
