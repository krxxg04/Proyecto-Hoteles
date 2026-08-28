'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Check, Phone, Sparkles, UserX, X } from 'lucide-react';
import { Boton, Campo, Card, Chip, ErrorCaja, Pildora } from '@/shared/ui/primitivos';
import { abrirCheckin } from '@/modules/estadias/ui/CajonCheckin';
import type { TipoCuarto } from '@/modules/cuartos/domain/tipos';
import { cambiarEstadoReserva, guardarReserva } from '../infrastructure/acciones';
import { ETIQUETA_RESERVA, TONO_RESERVA, type Reserva } from '../domain/tipos';

/**
 * Reservas. El mockup tenía la sección con un estado vacío; `plan.md` la dejó pendiente
 * («Vista Reservas completa: calendario/lista»). Esto es la lista.
 *
 * Una reserva **no bloquea la habitación**. Hasta que alguien llega y hace el check-in,
 * el cuarto se puede vender: en un hostal, bloquear al reservar es regalar noches a la
 * mitad de la gente que no aparece. Por eso se reserva un *tipo* de cuarto y el número
 * concreto se asigna al llegar.
 */

const hoyISO = () => new Date().toISOString().slice(0, 10);

function fecha(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** «Hoy», «mañana» o la fecha. Lo que se lee de un vistazo en el mostrador. */
function cuando(iso: string) {
  const hoy = hoyISO();
  const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (iso === hoy) return 'Hoy';
  if (iso === manana) return 'Mañana';
  if (iso < hoy) return `Atrasada · ${fecha(iso)}`;
  return fecha(iso);
}

function Formulario({
  tipos,
  onCerrar,
  onGuardada,
}: {
  tipos: TipoCuarto[];
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [entrada, setEntrada] = useState(hoyISO);
  const [salida, setSalida] = useState('');
  const [personas, setPersonas] = useState(1);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await guardarReserva({
        nombre_contacto: nombre.trim(),
        telefono: telefono.trim(),
        tipo_id: tipoId || null,
        fecha_entrada: entrada,
        fecha_salida: salida || null,
        personas,
        notas: notas.trim(),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onGuardada();
      onCerrar();
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="pop w-full max-w-md rounded-2xl bg-surf-float hair p-5"
        style={{ boxShadow: 'var(--elev-8)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">Nueva reserva</p>
            <p className="mt-0.5 text-[12.5px] text-tx-muted">
              No bloquea la habitación: el número se asigna al llegar.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Campo
            etiqueta="A nombre de"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            autoFocus
          />

          <Campo
            etiqueta="Teléfono (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            placeholder="987 654 321"
          />

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">
              Tipo de habitación
            </span>
            <select
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className="w-full rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx focus:border-brand-500"
            >
              <option value="">Sin preferencia</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Entrada"
              type="date"
              value={entrada}
              onChange={(e) => e.target.value && setEntrada(e.target.value)}
            />
            <Campo
              etiqueta="Salida (opcional)"
              type="date"
              value={salida}
              onChange={(e) => setSalida(e.target.value)}
            />
          </div>

          <Campo
            etiqueta="Personas"
            type="number"
            min={1}
            max={12}
            value={personas}
            onChange={(e) => setPersonas(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
          />

          <Campo
            etiqueta="Nota (opcional)"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Llega tarde, viene en bus…"
          />
        </div>

        {error && (
          <div className="mt-3">
            <ErrorCaja mensaje={error} />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Boton type="button" variante="fantasma" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" className="flex-[2]" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear reserva'}
          </Boton>
        </div>
      </form>
    </div>
  );
}

export function VistaReservas({
  reservas,
  tipos,
}: {
  reservas: Reserva[];
  tipos: TipoCuarto[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<'proximas' | 'todas'>('proximas');
  const [formulario, setFormulario] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const abiertas = reservas.filter((r) => r.estado === 'pendiente' || r.estado === 'confirmada');
  const visibles = filtro === 'proximas' ? abiertas : reservas;

  function marcar(r: Reserva, estado: 'confirmada' | 'cancelada' | 'no_show') {
    setError(null);
    empezar(async () => {
      const res = await cambiarEstadoReserva(r.id, estado);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pildora activa={filtro === 'proximas'} onClick={() => setFiltro('proximas')}>
          Próximas ({abiertas.length})
        </Pildora>
        <Pildora activa={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas ({reservas.length})
        </Pildora>
        <div className="ml-auto">
          <Boton variante="primario" onClick={() => setFormulario(true)}>
            <CalendarPlus className="size-4" />
            Nueva reserva
          </Boton>
        </div>
      </div>

      {error && <ErrorCaja mensaje={error} />}

      {visibles.length === 0 ? (
        <div className="grid place-items-center rounded-xl bg-surf hair py-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-bg-ter">
              <CalendarPlus className="size-6 text-tx-muted" />
            </div>
            <p className="mb-1 text-[15px] font-semibold">Aún no hay reservas</p>
            <p className="mb-4 text-[13px] text-tx-muted">
              Crea la primera, o pídeselo al asistente mientras atiendes a alguien.
            </p>
            <div className="flex justify-center gap-2">
              <Boton variante="primario" onClick={() => setFormulario(true)}>
                Nueva reserva
              </Boton>
              <Boton onClick={() => router.push('/asistente')}>
                <Sparkles className="size-4" />
                Usar asistente
              </Boton>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibles.map((r) => {
            const abierta = r.estado === 'pendiente' || r.estado === 'confirmada';
            const atrasada = abierta && r.fecha_entrada < hoyISO();

            return (
              <Card key={r.id} padding="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold">{r.nombre_contacto}</p>
                      <Chip tono={TONO_RESERVA[r.estado]}>{ETIQUETA_RESERVA[r.estado]}</Chip>
                      {atrasada && <Chip tono="danger">Sin resolver</Chip>}
                    </div>

                    <p className="mt-1 text-[13px] text-tx-sec">
                      <span className={atrasada ? 'text-danger' : ''}>
                        {cuando(r.fecha_entrada)}
                      </span>
                      {r.fecha_salida && ` → ${fecha(r.fecha_salida)}`}
                      {' · '}
                      {r.personas} persona{r.personas === 1 ? '' : 's'}
                      {r.tipos_cuarto?.nombre && ` · ${r.tipos_cuarto.nombre}`}
                      {r.cuartos?.numero && ` · hab. ${r.cuartos.numero}`}
                    </p>

                    {r.telefono && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-tx-muted">
                        <Phone className="size-3.5" />
                        {r.telefono}
                      </p>
                    )}

                    {r.notas && <p className="mt-1.5 text-[12.5px] text-tx-muted">{r.notas}</p>}
                  </div>

                  {abierta && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.estado === 'pendiente' && (
                        <Boton disabled={ocupado} onClick={() => marcar(r, 'confirmada')}>
                          <Check className="size-3.5" />
                          Confirmar
                        </Boton>
                      )}
                      <Boton variante="primario" disabled={ocupado} onClick={abrirCheckin}>
                        Hacer check-in
                      </Boton>
                      <Boton
                        variante="fantasma"
                        disabled={ocupado}
                        onClick={() => marcar(r, 'no_show')}
                        title="No se presentó"
                      >
                        <UserX className="size-3.5" />
                      </Boton>
                      <Boton
                        variante="peligro"
                        disabled={ocupado}
                        onClick={() => marcar(r, 'cancelada')}
                      >
                        <X className="size-3.5" />
                      </Boton>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {formulario && (
        <Formulario
          tipos={tipos}
          onCerrar={() => setFormulario(false)}
          onGuardada={() => router.refresh()}
        />
      )}
    </div>
  );
}
