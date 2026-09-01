'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import type { Caracteristica, CuartoConTipo, TipoCuarto } from '../domain/tipos';
import { ESTILO_ESTADO } from './estados';
import {
  cambiarActivoCuarto,
  cambiarActivoTipo,
  guardarCuarto,
  guardarTipoCuarto,
} from '../infrastructure/acciones';
import { Boton, Campo, Card, Chip, ErrorCaja, Pildora, soles } from '@/shared/ui/primitivos';
import { Celda, EncabezadoSeccion, Fila, Tabla } from '@/shared/ui/tabla';

/**
 * Cuartos y tarifario. El precio de cada estadía sale de aquí, nunca del cliente.
 *
 * `plan.md` lo marcaba como pendiente: «el precio del check-in debe tomar el tarifario
 * que configuren Admin y Recepción, no valores hardcodeados». La cotización ya lo hacía;
 * lo que faltaba era poder cambiarlo sin entrar a la base.
 */

/** Los campos del tarifario, en el orden en que se piensan en un mostrador. */
const CAMPOS: Array<{ clave: keyof TipoCuarto; etiqueta: string; sufijo?: string }> = [
  { clave: 'aforo', etiqueta: 'Aforo', sufijo: 'personas' },
  { clave: 'horas_lj', etiqueta: 'Horas del bloque (L-J)', sufijo: 'h' },
  { clave: 'horas_vd', etiqueta: 'Horas del bloque (V-D)', sufijo: 'h' },
  { clave: 'costo', etiqueta: 'Precio del bloque', sufijo: 'S/' },
  { clave: 'hora_extra', etiqueta: 'Hora extra', sufijo: 'S/' },
  { clave: 'amanecida', etiqueta: 'Noche L-J', sufijo: 'S/' },
  { clave: 'amanecida_vd', etiqueta: 'Noche V-D', sufijo: 'S/' },
  { clave: 'deposito', etiqueta: 'Depósito', sufijo: 'S/' },
];

/** Un tipo en blanco, con el bloque de horas que usa el hostal por defecto. */
const TIPO_NUEVO: TipoCuarto = {
  id: '',
  nombre: '',
  aforo: 2,
  costo: 0,
  horas_lj: 6,
  horas_vd: 4,
  hora_extra: 0,
  amanecida: 0,
  amanecida_vd: 0,
  deposito: 0,
  activo: true,
};

function FormularioTarifa({
  tipo,
  onCerrar,
}: {
  tipo: TipoCuarto;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<TipoCuarto>(tipo);
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      // Sin `id` el backend inserta; con `id`, actualiza.
      const { id, ...sinId } = valores;
      const r = await guardarTipoCuarto(id ? valores : sinId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onCerrar();
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(ev) => ev.stopPropagation()}
        className="pop max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surf-float hair p-5"
        style={{ boxShadow: 'var(--elev-8)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">{tipo.id ? tipo.nombre : 'Nuevo tipo de cuarto'}</p>
            <p className="mt-0.5 text-[12.5px] text-tx-muted">
              Lo que cambies aquí es lo que cobrará el próximo check-in.
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
            etiqueta="Nombre"
            value={valores.nombre}
            onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            {CAMPOS.map((c) => (
              <Campo
                key={String(c.clave)}
                etiqueta={`${c.etiqueta}${c.sufijo ? ` (${c.sufijo})` : ''}`}
                type="number"
                min={0}
                step={c.clave === 'aforo' || c.clave === 'horas_lj' || c.clave === 'horas_vd' ? 1 : 0.5}
                value={String(valores[c.clave] ?? 0)}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [c.clave]: Number(e.target.value) || 0 }))
                }
              />
            ))}
          </div>
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
            {guardando ? 'Guardando…' : 'Guardar tarifa'}
          </Boton>
        </div>
      </form>
    </div>
  );
}

/**
 * Alta y edición de un cuarto.
 *
 * El estado no se toca aquí: lo mueve `cambiar_estado_cuarto()`, que audita quién lo hizo
 * y a quién le corresponde. Un cuarto nuevo nace en «Disponible».
 */
function FormularioCuarto({
  cuarto,
  tipos,
  caracteristicas,
  onCerrar,
}: {
  cuarto: CuartoConTipo | null;
  tipos: TipoCuarto[];
  caracteristicas: Caracteristica[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [numero, setNumero] = useState(cuarto?.numero ?? '');
  const [tipoId, setTipoId] = useState(cuarto?.tipo_id ?? tipos[0]?.id ?? '');
  const [aforo, setAforo] = useState(String(cuarto?.aforo ?? 2));
  const [marcadas, setMarcadas] = useState<string[]>(cuarto?.caracteristicas ?? []);
  const [nota, setNota] = useState(cuarto?.nota ?? '');
  const [costo, setCosto] = useState(cuarto?.tarifa_costo?.toString() ?? '');
  const [amanecida, setAmanecida] = useState(cuarto?.tarifa_amanecida?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | undefined>();
  const [guardando, empezar] = useTransition();

  /** Lo que cobra el tipo elegido. Es el número que hereda el cuarto si no se pone otro. */
  const tipo = tipos.find((t) => t.id === tipoId);

  function alternar(clave: string) {
    setMarcadas((m) => (m.includes(clave) ? m.filter((x) => x !== clave) : [...m, clave]));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await guardarCuarto({
        id: cuarto?.id,
        numero,
        tipo_id: tipoId,
        aforo: Number(aforo),
        caracteristicas: marcadas,
        nota,
        // Vacío significa «la del tipo», no cero.
        tarifa_costo: costo === '' ? null : Number(costo),
        tarifa_amanecida: amanecida === '' ? null : Number(amanecida),
      });
      if (!r.ok) {
        setError(r.error);
        setCampo(r.campo);
        return;
      }
      router.refresh();
      onCerrar();
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(ev) => ev.stopPropagation()}
        className="pop max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surf-float hair p-5"
        style={{ boxShadow: 'var(--elev-8)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">
              {cuarto ? `Habitación ${cuarto.numero}` : 'Nuevo cuarto'}
            </p>
            <p className="mt-0.5 text-[12.5px] text-tx-muted">
              {cuarto
                ? 'El estado se cambia desde Habitaciones, para que quede en el historial.'
                : 'Nace como Disponible. El estado se lleva después desde Habitaciones.'}
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
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Número"
              autoFocus
              placeholder="302"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              error={campo === 'numero' ? error ?? undefined : undefined}
            />
            <Campo
              etiqueta="Aforo máx. (personas)"
              type="number"
              min={1}
              max={12}
              value={aforo}
              onChange={(e) => setAforo(e.target.value)}
              error={campo === 'aforo' ? error ?? undefined : undefined}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Tipo</span>
            <select
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className="w-full rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx focus:border-brand-500"
            >
              {tipos.length === 0 && <option value="">Crea antes un tipo de cuarto</option>}
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {campo === 'tipo_id' && error && (
              <span className="mt-1 block text-[12px] text-danger">{error}</span>
            )}
          </label>

          <div className="rounded-lg bg-surf hair p-3">
            <span className="block text-[12.5px] font-medium text-tx-sec">
              ¿Este cuarto cobra distinto que su tipo?
            </span>
            <p className="mt-0.5 mb-2.5 text-[12px] text-tx-muted">
              {tipo
                ? `Déjalo vacío y cobra lo de ${tipo.nombre}: ${soles(tipo.costo)} el bloque y ${soles(tipo.amanecida)} la noche.`
                : 'Déjalo vacío y cobra lo que diga su tipo.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                etiqueta={`Bloque de ${tipo?.horas_lj ?? 6} h (S/)`}
                type="number"
                min={0}
                step={0.5}
                placeholder={tipo ? tipo.costo.toFixed(2) : ''}
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
              />
              <Campo
                etiqueta="Noche completa (S/)"
                type="number"
                min={0}
                step={0.5}
                placeholder={tipo ? tipo.amanecida.toFixed(2) : ''}
                value={amanecida}
                onChange={(e) => setAmanecida(e.target.value)}
              />
            </div>
          </div>

          {caracteristicas.length > 0 && (
            <div>
              <span className="block text-[12.5px] font-medium text-tx-sec">
                ¿Qué tiene el cuarto?
              </span>
              <p className="mt-0.5 mb-2 text-[12px] text-tx-muted">
                El asistente las usa para saber qué cuarto ofrecer en cada check-in.
              </p>
              <div className="flex flex-wrap gap-2">
                {caracteristicas.map((c) => (
                  <Pildora
                    key={c.clave}
                    activa={marcadas.includes(c.clave)}
                    onClick={() => alternar(c.clave)}
                  >
                    {c.label}
                  </Pildora>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">
              Nota <span className="font-normal text-tx-muted">(opcional)</span>
            </span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Lo que conviene saber antes de darlo: wifi lento, ventana a la calle…"
              className="w-full resize-none rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx placeholder:text-tx-dis focus:border-brand-500"
            />
          </label>
        </div>

        {error && !campo && (
          <div className="mt-3">
            <ErrorCaja mensaje={error} />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Boton type="button" variante="fantasma" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" className="flex-[2]" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </div>
  );
}

/**
 * Lo inhabilitado. Vive al pie y plegado en su propia sección: no estorba el día a día,
 * pero deja claro que sigue existiendo y que vuelve con un clic.
 */
function Inhabilitados({
  cuartos,
  tipos,
  ocupado,
  onCuarto,
  onTipo,
}: {
  cuartos: CuartoConTipo[];
  tipos: TipoCuarto[];
  ocupado: boolean;
  onCuarto: (c: CuartoConTipo) => void;
  onTipo: (t: TipoCuarto) => void;
}) {
  if (cuartos.length === 0 && tipos.length === 0) return null;

  return (
    <section>
      <EncabezadoSeccion
        titulo="Inhabilitados"
        subtitulo="Siguen en el histórico. Vuelven al servicio cuando los habilites."
      />

      <div className="flex flex-col gap-2">
        {tipos.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center gap-3">
              <Chip tono="muted">tipo</Chip>
              <p className="text-[14px] font-medium text-tx-sec">{t.nombre}</p>
              <Boton className="ml-auto" disabled={ocupado} onClick={() => onTipo(t)}>
                <RotateCcw className="size-4" />
                Habilitar
              </Boton>
            </div>
          </Card>
        ))}

        {cuartos.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center gap-3">
              <Chip tono="muted">cuarto</Chip>
              <p className="text-[14px] font-medium text-tx-sec">
                {c.numero} <span className="text-tx-muted">· {c.tipo}</span>
              </p>
              <Boton className="ml-auto" disabled={ocupado} onClick={() => onCuarto(c)}>
                <RotateCcw className="size-4" />
                Habilitar
              </Boton>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function VistaCuartosAdmin({
  cuartos,
  tipos,
  caracteristicas,
}: {
  cuartos: CuartoConTipo[];
  tipos: TipoCuarto[];
  caracteristicas: Caracteristica[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<TipoCuarto | null>(null);
  const [cuartoAbierto, setCuartoAbierto] = useState<CuartoConTipo | null>(null);
  const [creandoCuarto, setCreandoCuarto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function cambiarCuarto(c: CuartoConTipo, activo: boolean) {
    setError(null);
    empezar(async () => {
      const r = await cambiarActivoCuarto(c.id, activo);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function cambiarTipo(t: TipoCuarto, activo: boolean) {
    setError(null);
    empezar(async () => {
      const r = await cambiarActivoTipo(t.id, activo);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const activos = cuartos.filter((c) => c.activo);
  const inactivos = cuartos.filter((c) => !c.activo);
  const tiposActivos = tipos.filter((t) => t.activo);
  const tiposInactivos = tipos.filter((t) => !t.activo);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <EncabezadoSeccion
          titulo="Tarifario"
          subtitulo="Lo que cobra cada tipo de cuarto"
          accion={
            <Boton onClick={() => setEditando(TIPO_NUEVO)}>
              <Plus className="size-4" />
              Nuevo tipo
            </Boton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiposActivos.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14.5px] font-semibold">{t.nombre}</p>
                <div className="flex items-center gap-1.5">
                  <Chip tono="muted">aforo {t.aforo}</Chip>
                  <button type="button"
                    onClick={() => setEditando(t)}
                    aria-label={`Editar la tarifa de ${t.nombre}`}
                    className="grid size-7 place-items-center rounded-md text-tx-muted transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button"
                    onClick={() => cambiarTipo(t, false)}
                    disabled={ocupado}
                    title="Inhabilitar este tipo"
                    aria-label={`Inhabilitar el tipo ${t.nombre}`}
                    className="grid size-7 place-items-center rounded-md text-tx-muted transition-colors hover:bg-surf-hover hover:text-danger cursor-pointer"
                  >
                    <Ban className="size-3.5" />
                  </button>
                </div>
              </div>

              <dl className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Bloque de {t.horas_lj} h (L-J)</dt>
                  <dd className="tabular-nums">{soles(t.costo)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Hora extra</dt>
                  <dd className="tabular-nums">{soles(t.hora_extra)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Noche L-J</dt>
                  <dd className="tabular-nums">{soles(t.amanecida)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tx-muted">Noche V-D</dt>
                  <dd className="tabular-nums">{soles(t.amanecida_vd)}</dd>
                </div>
                <div className="hair-t flex justify-between pt-1.5">
                  <dt className="text-tx-muted">Depósito</dt>
                  <dd className="tabular-nums">{soles(t.deposito)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <EncabezadoSeccion
          titulo="Cuartos"
          subtitulo={`${activos.length} habitaciones activas`}
          accion={
            <Boton variante="primario" onClick={() => setCreandoCuarto(true)}>
              <Plus className="size-4" />
              Nuevo cuarto
            </Boton>
          }
        />

        {error && (
          <div className="mb-3">
            <ErrorCaja mensaje={error} />
          </div>
        )}

        <Tabla columnas={['Número', 'Tipo', 'Estado', 'Aforo', 'Características', 'Editar · Inhabilitar']}>
          {activos.map((c) => {
            const e = ESTILO_ESTADO[c.estado];
            return (
              <Fila key={c.id}>
                <Celda className="text-[15px] font-semibold tabular-nums">{c.numero}</Celda>
                <Celda className="text-tx-sec">{c.tipo}</Celda>
                <Celda>
                  <Chip tono="muted">
                    <span style={{ color: e.color }}>{e.etiqueta}</span>
                  </Chip>
                </Celda>
                <Celda className="tabular-nums text-tx-sec" oculta="sm">
                  {c.aforo}
                </Celda>
                <Celda oculta="md">
                  <div className="flex flex-wrap gap-1">
                    {c.caracteristicas.length === 0 ? (
                      <span className="text-tx-dis">—</span>
                    ) : (
                      c.caracteristicas.map((x) => (
                        <Chip key={x} tono="brand">
                          {x.replace('_', ' ')}
                        </Chip>
                      ))
                    )}
                  </div>
                </Celda>
                <Celda className="text-right">
                  <div className="flex justify-end gap-1">
                    <button type="button"
                      onClick={() => setCuartoAbierto(c)}
                      aria-label={`Editar la habitación ${c.numero}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button type="button"
                      onClick={() => cambiarCuarto(c, false)}
                      disabled={ocupado}
                      title="Inhabilitar"
                      aria-label={`Inhabilitar la habitación ${c.numero}`}
                      className="grid size-8 cursor-pointer place-items-center gap-1 rounded-md px-2 text-[12px] text-tx-muted hover:bg-surf-hover hover:text-danger"
                    >
                      <Ban className="size-4" />
                    </button>
                  </div>
                </Celda>
              </Fila>
            );
          })}
        </Tabla>

        <p className="mt-3 text-[12px] text-tx-muted">
          Inhabilitar no borra nada: hay estadías, ventas y auditoría apuntando al cuarto. Se niega
          si todavía tiene a alguien dentro, y se puede volver a habilitar cuando quieras.
        </p>
      </section>

      <Inhabilitados
        cuartos={inactivos}
        tipos={tiposInactivos}
        ocupado={ocupado}
        onCuarto={(c) => cambiarCuarto(c, true)}
        onTipo={(t) => cambiarTipo(t, true)}
      />

      {editando && (
        <FormularioTarifa tipo={editando} onCerrar={() => setEditando(null)} />
      )}

      {(creandoCuarto || cuartoAbierto) && (
        <FormularioCuarto
          cuarto={cuartoAbierto}
          tipos={tiposActivos}
          caracteristicas={caracteristicas}
          onCerrar={() => {
            setCreandoCuarto(false);
            setCuartoAbierto(null);
          }}
        />
      )}
    </div>
  );
}
