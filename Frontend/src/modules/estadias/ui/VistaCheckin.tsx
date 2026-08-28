'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BedDouble,
  CalendarRange,
  Check,
  Clock,
  Moon,
  Receipt,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Boton, Campo, Card, Chip, ErrorCaja, soles } from '@/shared/ui/primitivos';
import { MEDIOS_PAGO, ETIQUETA_MEDIO, type MedioPago } from '@/shared/dominio/tipos';
import { CapturaFoto } from '@/modules/medios/ui/CapturaFoto';
import { cotizar, registrarCheckin, sugerirCuartos } from '../infrastructure/acciones';
import {
  TIPOS_DOC,
  type Acompanante,
  type Catalogos,
  type CuartoSugerido,
  type DetalleTarifa,
  type ModoEstadia,
  type ResultadoCheckin,
} from '../domain/tipos';

/**
 * Check-in por formulario, en cuatro pasos: Huésped, Estadía, Habitación y Pago.
 *
 * Portado del asistente de `renderCheckin()` del prototipo, con dos diferencias que
 * manda el ADR-002:
 *
 *  - El precio NO se calcula aquí. El prototipo usaba constantes (`RATE_HOUR`,
 *    `RATE_NIGHT`); aquí se cotiza contra el tarifario del servidor en cuanto hay
 *    habitación elegida, y al confirmar la base lo vuelve a calcular. Lo que se ve
 *    es informativo; lo que se cobra sale de Postgres.
 *  - La habitación se elige de las que de verdad admiten check-in.
 *
 * Es la vía de respaldo del asistente: lo mismo se puede hacer hablando.
 */

const PASOS = ['Huésped', 'Estadía', 'Habitación', 'Pago'] as const;

const MODOS: Array<{ modo: ModoEstadia; icono: typeof Clock; titulo: string; sub: string }> = [
  { modo: 'horas', icono: Clock, titulo: 'Por horas', sub: 'Descanso corto' },
  { modo: 'dia', icono: Moon, titulo: 'Por 1 día', sub: 'Una noche' },
  { modo: 'rango', icono: CalendarRange, titulo: 'Rango de días', sub: 'Varias noches' },
];

const hoyISO = () => new Date().toISOString().slice(0, 10);

function sumarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  f.setDate(f.getDate() + dias);
  return f.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string) {
  const [ay, am, ad] = desde.split('-').map(Number);
  const [by, bm, bd] = hasta.split('-').map(Number);
  return Math.round((+new Date(by, bm - 1, bd) - +new Date(ay, am - 1, ad)) / 86400000);
}

/** Stepper de a uno. Los botones llevan etiqueta: el símbolo solo no se lee en voz alta. */
function Contador({
  valor,
  onCambiar,
  etiqueta,
  min = 1,
  max = 12,
}: {
  valor: number;
  onCambiar: (n: number) => void;
  etiqueta: string;
  min?: number;
  max?: number;
}) {
  const boton = 'grid size-10 place-items-center rounded-md bg-surf hair text-[17px] text-tx-sec transition-colors hover:bg-surf-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={boton}
        aria-label={`Menos ${etiqueta}`}
        disabled={valor <= min}
        onClick={() => onCambiar(valor - 1)}
      >
        −
      </button>
      <span className="w-10 text-center text-[15px] font-semibold tabular-nums">{valor}</span>
      <button
        type="button"
        className={boton}
        aria-label={`Más ${etiqueta}`}
        disabled={valor >= max}
        onClick={() => onCambiar(valor + 1)}
      >
        +
      </button>
    </div>
  );
}

/**
 * En la página el asistente va dentro de una tarjeta; en el cajón el marco ya lo pone
 * el cajón. Anular el borde y la sombra con clases seria pelearse con el tema.
 */
function Marco({
  enCajon,
  children,
}: {
  enCajon: boolean;
  children: React.ReactNode;
}) {
  if (enCajon) return <>{children}</>;
  return <Card padding="p-5">{children}</Card>;
}

function Progreso({ paso }: { paso: number }) {
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {PASOS.map((nombre, i) => {
        const n = i + 1;
        const hecho = n < paso;
        const actual = n === paso;
        return (
          <div key={nombre} className="flex flex-1 items-center gap-1.5">
            <div
              aria-current={actual ? 'step' : undefined}
              className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                hecho || actual ? 'bg-brand-500 text-onbrand' : 'bg-bg-ter text-tx-muted'
              }`}
            >
              {hecho ? '✓' : n}
            </div>
            {i < PASOS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded-full ${hecho ? 'bg-brand-500' : 'bg-bg-ter'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VistaCheckin({
  catalogos,
  turnoAbierto,
  /**
   * Dentro del cajón lateral el marco lo pone el cajón: aquí sobra la tarjeta y el
   * ancho máximo. Es la misma pantalla, no una copia.
   */
  enCajon = false,
  onHecho,
}: {
  catalogos: Catalogos;
  turnoAbierto: boolean;
  enCajon?: boolean;
  onHecho?: () => void;
}) {
  const router = useRouter();

  const [paso, setPaso] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<ResultadoCheckin | null>(null);
  const [enviando, empezar] = useTransition();

  // 1 · Huésped
  const [nombre, setNombre] = useState('');
  const [tipoDoc, setTipoDoc] = useState<string>('DNI');
  const [numDoc, setNumDoc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [personas, setPersonas] = useState(1);
  const [acompanantes, setAcompanantes] = useState<Acompanante[]>([]);

  // 2 · Estadía
  const [modo, setModo] = useState<ModoEstadia>('rango');
  const [horas, setHoras] = useState(6);
  const [noches, setNoches] = useState(2);
  const [entrada, setEntrada] = useState(hoyISO);

  // 3 · Habitación
  const [cuartos, setCuartos] = useState<CuartoSugerido[] | null>(null);
  const [cuartoId, setCuartoId] = useState('');
  const [tarifa, setTarifa] = useState<DetalleTarifa | null>(null);
  const [cotizando, setCotizando] = useState(false);

  // 4 · Pago
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  const [banco, setBanco] = useState('');

  const salida = sumarDias(entrada, modo === 'dia' ? 1 : noches);

  /**
   * Los acompañantes son siempre `personas - 1`: el titular ya está arriba.
   *
   * Va en el manejador y no en un efecto que mire a `personas`: la lista solo cambia
   * cuando alguien pulsa el contador, y reaccionar a ella después obliga a un render
   * de más y a que React vuelva a entrar por el mismo sitio.
   */
  function cambiarPersonas(n: number) {
    setPersonas(n);
    setAcompanantes((previos) =>
      Array.from({ length: Math.max(0, n - 1) }, (_, i) => previos[i] ?? { nombre: '' })
    );
  }

  /** Al llegar al paso de habitación se piden las que de verdad admiten a esa gente. */
  useEffect(() => {
    if (paso !== 3) return;
    let vigente = true;

    void (async () => {
      setCuartos(null);
      const r = await sugerirCuartos(personas);
      if (!vigente) return;
      if (!r.ok) {
        setError(r.error);
        setCuartos([]);
        return;
      }
      setCuartos(r.datos);
      setCuartoId((actual) => actual || r.datos[0]?.cuarto_id || '');
    })();

    return () => {
      vigente = false;
    };
  }, [paso, personas]);

  /** El precio sale del tarifario del servidor, nunca de una constante del cliente. */
  useEffect(() => {
    let vigente = true;

    void (async () => {
      if (!cuartoId) {
        setTarifa(null);
        return;
      }
      setCotizando(true);
      const r = await cotizar({
        cuarto_id: cuartoId,
        modo,
        horas: modo === 'horas' ? horas : null,
        noches: modo === 'rango' ? noches : modo === 'dia' ? 1 : null,
        fecha_entrada: entrada,
      });
      if (!vigente) return;
      setCotizando(false);
      setTarifa(r.ok ? r.datos : null);
      if (!r.ok) setError(r.error);
    })();

    return () => {
      vigente = false;
    };
  }, [cuartoId, modo, horas, noches, entrada]);

  const faltaEnPaso1 = nombre.trim().length < 2 || numDoc.trim().length < 6;
  const faltaEnPaso3 = !cuartoId;
  const faltaEnPaso4 = medio === 'tarjeta' && !banco;

  const puedeSeguir =
    (paso === 1 && !faltaEnPaso1) || paso === 2 || (paso === 3 && !faltaEnPaso3);

  function confirmar() {
    setError(null);
    empezar(async () => {
      const r = await registrarCheckin({
        cuarto_id: cuartoId,
        modo,
        horas: modo === 'horas' ? horas : null,
        noches: modo === 'rango' ? noches : modo === 'dia' ? 1 : null,
        fecha_entrada: entrada,
        personas,
        nombre: nombre.trim(),
        tipo_doc: tipoDoc,
        num_doc: numDoc.trim(),
        telefono: telefono.trim(),
        medio,
        banco: medio === 'tarjeta' ? banco : null,
        acompanantes: acompanantes.filter((a) => a.nombre.trim().length >= 2),
      });

      if (!r.ok) {
        setError(r.error);
        return;
      }

      setHecho(r.datos);
      router.refresh();
      onHecho?.();
    });
  }

  // ------------------------------------------------------------------- hecho

  if (hecho) {
    return (
      <div className={enCajon ? '' : 'mx-auto max-w-2xl'}>
        <Marco enCajon={enCajon}>
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15">
              <Check className="size-[18px] text-success" />
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-semibold">Check-in confirmado</p>
              <p className="mt-1 text-[13.5px] text-tx-sec">
                {nombre} está en la habitación {hecho.cuarto}.
              </p>

              <div className="mt-4 rounded-lg bg-bg-ter hair p-3">
                {hecho.tarifa.detalle.map((d, i) => (
                  <p key={i} className="flex justify-between py-0.5 text-[13px] text-tx-sec">
                    <span>{d.concepto}</span>
                    <span className="tabular-nums">{soles(d.monto)}</span>
                  </p>
                ))}
                <p className="mt-1.5 flex justify-between border-t border-[var(--line)] pt-1.5 text-[14px] font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{soles(hecho.tarifa.total)}</span>
                </p>
              </div>

              {!turnoAbierto && (
                <p className="mt-3 flex items-start gap-2 text-[12.5px] text-warning">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  No había turno abierto, así que el cobro no entró en la caja de ningún turno.
                </p>
              )}

              {/*
                Verificación de identidad del prototipo. Va aquí y no antes porque hasta
                que el check-in no está hecho no hay huésped al que asociar la foto.
              */}
              <div className="mt-4">
                <CapturaFoto
                  tipo="dni"
                  huespedId={hecho.huesped_id}
                  estadiaId={hecho.estadia_id}
                  etiqueta="Foto del documento"
                  onSubida={() => {}}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Boton variante="primario" onClick={() => router.push('/habitaciones')}>
                  Ver habitaciones
                </Boton>
                <Boton
                  onClick={() => {
                    setHecho(null);
                    setPaso(1);
                    setNombre('');
                    setNumDoc('');
                    setTelefono('');
                    cambiarPersonas(1);
                    setCuartoId('');
                    setTarifa(null);
                  }}
                >
                  Otro check-in
                </Boton>
              </div>
            </div>
          </div>
        </Marco>
      </div>
    );
  }

  // ------------------------------------------------------------------- pasos

  return (
    <div className={enCajon ? '' : 'mx-auto max-w-2xl'}>
      <Marco enCajon={enCajon}>
        <Progreso paso={paso} />

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-tx-muted">
          Paso {paso} de {PASOS.length} · {PASOS[paso - 1]}
        </p>

        {paso === 1 && (
          <div className="flex flex-col gap-3">
            <Campo
              etiqueta="Nombre del huésped"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              autoFocus
            />

            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Documento</span>
                <select
                  value={tipoDoc}
                  onChange={(e) => setTipoDoc(e.target.value)}
                  className="w-full rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx focus:border-brand-500"
                >
                  {TIPOS_DOC.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <div className="col-span-2">
                <Campo
                  etiqueta="Número"
                  value={numDoc}
                  onChange={(e) => setNumDoc(e.target.value)}
                  inputMode="numeric"
                  placeholder="8 dígitos"
                />
              </div>
            </div>

            <Campo
              etiqueta="Teléfono (opcional)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              placeholder="987 654 321"
            />

            <div>
              <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">
                N.º de personas
              </span>
              <div className="flex items-center gap-3">
                <Contador valor={personas} onCambiar={cambiarPersonas} etiqueta="personas" />
                <span className="text-[12.5px] text-tx-muted">
                  {personas === 1
                    ? 'Solo el titular'
                    : `+ ${personas - 1} acompañante${personas > 2 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {acompanantes.length > 0 && (
              <div className="up flex flex-col gap-2.5 pt-1">
                {acompanantes.map((a, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <Campo
                      etiqueta={`Acompañante ${i + 1}`}
                      value={a.nombre}
                      placeholder="Nombre y apellido"
                      onChange={(e) =>
                        setAcompanantes((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x))
                        )
                      }
                    />
                    <Campo
                      etiqueta="Documento"
                      value={a.num_doc ?? ''}
                      inputMode="numeric"
                      placeholder="Opcional"
                      onChange={(e) =>
                        setAcompanantes((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, num_doc: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {paso === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[12.5px] font-medium text-tx-sec">¿Cómo se hospeda?</p>
              <div className="flex gap-2">
                {MODOS.map(({ modo: m, icono: Icono, titulo, sub }) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModo(m)}
                    aria-pressed={modo === m}
                    className={`flex-1 rounded-md hair px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      modo === m ? 'bg-surf-hover' : 'bg-surf hover:bg-surf-hover'
                    }`}
                  >
                    <Icono
                      className={`size-[18px] ${modo === m ? 'text-brand-500' : 'text-tx-muted'}`}
                    />
                    <p className="mt-1 text-[13px] font-semibold">{titulo}</p>
                    <p className="text-[11px] leading-snug text-tx-muted">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo
                etiqueta="Fecha de entrada"
                type="date"
                value={entrada}
                onChange={(e) => e.target.value && setEntrada(e.target.value)}
              />
              {modo === 'rango' && (
                <Campo
                  etiqueta="Fecha de salida"
                  type="date"
                  value={salida}
                  onChange={(e) => {
                    const d = diasEntre(entrada, e.target.value);
                    if (d >= 1) setNoches(Math.min(60, d));
                  }}
                />
              )}
            </div>

            {modo === 'horas' && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-tx-sec">Duración</p>
                <div className="flex gap-2">
                  {[3, 6, 12].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHoras(h)}
                      aria-pressed={horas === h}
                      className={`rounded-md hair px-3.5 py-2 text-[13px] font-medium transition-colors cursor-pointer ${
                        horas === h ? 'bg-surf-hover text-tx' : 'bg-surf text-tx-sec hover:bg-surf-hover'
                      }`}
                    >
                      {h} h
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modo === 'dia' && (
              <p className="flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px] text-info bg-info/10">
                <Moon className="size-4" />
                Salida el {salida.split('-').reverse().join('/')}, 12:00 m.
              </p>
            )}

            {modo === 'rango' && (
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] font-medium text-tx-sec">Número de noches</span>
                <div className="ml-auto">
                  <Contador valor={noches} onCambiar={setNoches} etiqueta="noches" max={60} />
                </div>
              </div>
            )}

            <p className="text-[12.5px] text-tx-muted">
              El precio no se decide aquí: sale del tarifario en cuanto elijas la habitación.
            </p>
          </div>
        )}

        {paso === 3 && (
          <div className="flex flex-col gap-2">
            {cuartos === null && (
              <div className="flex flex-col gap-2">
                <div className="sk h-11 rounded-md" />
                <div className="sk h-11 rounded-md" />
                <div className="sk h-11 rounded-md" />
              </div>
            )}

            {cuartos?.length === 0 && (
              <p className="rounded-lg bg-surf hair px-4 py-6 text-center text-[13.5px] text-tx-sec">
                No hay ninguna habitación libre para {personas} persona{personas > 1 ? 's' : ''}.
                Vuelve atrás y ajusta el número, o libera una habitación.
              </p>
            )}

            {cuartos && cuartos.length > 0 && (
              <>
                <p className="mb-1 flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px] text-brand-500 bg-brand-500/10">
                  <Sparkles className="size-4" />
                  La que mejor encaja es la <b>{cuartos[0].numero}</b> ({cuartos[0].tipo}).
                </p>

                {cuartos.map((c) => (
                  <label
                    key={c.cuarto_id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md hair px-3 py-2.5 transition-colors ${
                      cuartoId === c.cuarto_id ? 'bg-surf-hover' : 'bg-surf hover:bg-surf-hover'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cuarto"
                      checked={cuartoId === c.cuarto_id}
                      onChange={() => setCuartoId(c.cuarto_id)}
                      className="accent-[#7C4DFF]"
                    />
                    <BedDouble className="size-[17px] text-tx-muted" />
                    <span className="text-[13.5px] font-medium">{c.numero}</span>
                    <span className="text-[13px] text-tx-sec">{c.tipo}</span>
                    <span className="ml-auto text-[12px] text-tx-muted">aforo {c.aforo}</span>
                  </label>
                ))}

                <div className="mt-2 rounded-lg bg-bg-ter hair p-3">
                  {cotizando && <p className="text-[13px] text-tx-muted">Consultando el tarifario…</p>}
                  {!cotizando && tarifa && (
                    <>
                      {tarifa.detalle.map((d, i) => (
                        <p key={i} className="flex justify-between py-0.5 text-[13px] text-tx-sec">
                          <span>
                            {d.concepto}
                            {d.fin_de_semana && <span className="text-tx-muted"> · fin de semana</span>}
                          </span>
                          <span className="tabular-nums">{soles(d.monto)}</span>
                        </p>
                      ))}
                      <p className="mt-1.5 flex justify-between border-t border-[var(--line)] pt-1.5 text-[14px] font-semibold">
                        <span>Total</span>
                        <span className="tabular-nums">{soles(tarifa.total)}</span>
                      </p>
                      {tarifa.deposito > 0 && (
                        <p className="mt-0.5 flex justify-between text-[12.5px] text-tx-muted">
                          <span>Depósito</span>
                          <span className="tabular-nums">{soles(tarifa.deposito)}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {paso === 4 && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-tx-sec">¿Cómo paga?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEDIOS_PAGO.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMedio(m)}
                    aria-pressed={medio === m}
                    className={`rounded-md hair px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer ${
                      medio === m ? 'bg-surf-hover text-tx' : 'bg-surf text-tx-sec hover:bg-surf-hover'
                    }`}
                  >
                    {ETIQUETA_MEDIO[m]}
                  </button>
                ))}
              </div>
            </div>

            {medio === 'tarjeta' && (
              <label className="up block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Banco</span>
                <select
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  className="w-full rounded-md bg-bg-ter hair px-3 py-2 text-[14px] text-tx focus:border-brand-500"
                >
                  <option value="">Elige el banco</option>
                  {catalogos.bancos.map((b) => (
                    <option key={b.clave} value={b.clave}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="rounded-lg bg-bg-ter hair p-3 text-[13px]">
              <p className="flex justify-between py-0.5">
                <span className="text-tx-sec">Huésped</span>
                <span>{nombre}</span>
              </p>
              <p className="flex justify-between py-0.5">
                <span className="text-tx-sec">Habitación</span>
                <span>{cuartos?.find((c) => c.cuarto_id === cuartoId)?.numero ?? '—'}</span>
              </p>
              <p className="flex justify-between py-0.5">
                <span className="text-tx-sec">Estadía</span>
                <span>
                  {modo === 'horas'
                    ? `${horas} horas`
                    : modo === 'dia'
                      ? '1 noche'
                      : `${noches} noches`}
                </span>
              </p>
              <p className="mt-1.5 flex justify-between border-t border-[var(--line)] pt-1.5 text-[14px] font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{tarifa ? soles(tarifa.total) : '—'}</span>
              </p>
            </div>

            <p className="flex items-center gap-2 rounded-md px-3 py-2.5 text-[12.5px] text-tx-sec bg-surf hair">
              <Receipt className="size-4 shrink-0 text-tx-muted" />
              El importe final lo calcula el servidor al confirmar. Este es el del tarifario de ahora.
            </p>

            {!turnoAbierto && (
              <p className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[12.5px] text-warning bg-warning/10">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                No hay turno abierto. El check-in se registra igual, pero el cobro no entrará en
                la caja de ningún turno. Ábrelo desde Caja si quieres que cuadre.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4">
            <ErrorCaja mensaje={error} />
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {paso > 1 && (
            <Boton className="flex-1" onClick={() => setPaso((p) => p - 1)} disabled={enviando}>
              Atrás
            </Boton>
          )}
          {paso < PASOS.length ? (
            <Boton
              variante="primario"
              className="flex-[2]"
              disabled={!puedeSeguir}
              onClick={() => setPaso((p) => p + 1)}
            >
              Continuar
            </Boton>
          ) : (
            <Boton
              variante="primario"
              className="flex-[2]"
              disabled={enviando || faltaEnPaso4 || !cuartoId}
              onClick={confirmar}
            >
              <Check className="size-4" />
              {enviando ? 'Registrando…' : 'Confirmar check-in'}
            </Boton>
          )}
        </div>
      </Marco>

      {!enCajon && (
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-tx-muted">
        <Chip tono="brand" icono={<Sparkles className="size-3" />}>
          Atajo
        </Chip>
        Lo mismo se puede pedir hablando: «Llegó una pareja, matrimonial, 2 noches, efectivo».
      </p>
      )}
    </div>
  );
}
