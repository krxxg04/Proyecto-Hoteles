'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Sparkles, Check, X, CircleAlert } from 'lucide-react';
import { interpretar, ejecutar } from '../infrastructure/acciones';
import type { ContextoConversacion, TarjetaAccion } from '../domain/tipos';
import { Boton, Card, Chip, ErrorCaja } from '@/shared/ui/primitivos';
import type { Rol } from '@/shared/dominio/tipos';

/**
 * Barra del asistente. La IA propone, una persona confirma — nunca al revés.
 *
 * Toda tarjeta va rotulada como generada por IA, y las que mueven dinero o stock exigen
 * confirmación explícita (regla de producto de context.md).
 */

type Turno =
  | { quien: 'usuario'; texto: string }
  | { quien: 'asistente'; texto: string }
  | {
      quien: 'tarjeta';
      tarjeta: TarjetaAccion;
      resuelta?: 'hecho' | 'descartada';
      /** Lo que devolvió la acción. En las consultas es la respuesta, no un acuse. */
      respuesta?: string;
    };

/**
 * Los ejemplos que se ofrecen dependen del rol: a quien limpia no se le sugiere un
 * check-in, que es justo lo que no puede hacer. El backend manda los suyos cuando no
 * entiende algo; estos son los del arranque, antes de la primera frase.
 */
const SUGERENCIAS: Record<Rol, string[]> = {
  administrador: [
    'Llegó una pareja, matrimonial, 2 noches, efectivo',
    '2 aguas a la 101, con yape',
    'A la 203, 2 toallas',
    '¿Cuánta agua queda?',
  ],
  recepcion: [
    'Llegó una pareja, matrimonial, 2 noches, efectivo',
    '2 aguas a la 101, con yape',
    'A la 203, 2 toallas',
    '¿La 205 está lista?',
  ],
  limpieza: [
    'A la 203, 2 toallas',
    'La 105 ya está limpia',
    '¿La 205 está lista?',
    'Se rompió un vaso en la 204',
  ],
  mantenimiento: [
    'La 106 queda en mantenimiento',
    '¿La 204 está lista?',
    'A la 204, 1 rollo de papel',
    'Se rompió una ducha en la 106',
  ],
};

/**
 * Traduce lo que devolvió la acción a una frase.
 *
 * Las consultas devolvían un «Hecho.» y tiraban el dato: preguntar cuánta agua queda y
 * que respondan «hecho» no es una respuesta. Las que escriben sí se confirman con un
 * acuse, porque el resultado ya se ve en la pantalla que corresponda.
 */
function redactar(tarjeta: TarjetaAccion, datos: unknown): string | undefined {
  if (tarjeta.accion === 'consultar_stock') {
    const lista = (datos ?? []) as Array<{ nombre: string; stock: number; unidad: string }>;
    if (lista.length === 0) return 'No encontré ese producto en el catálogo.';
    return lista
      .slice(0, 6)
      .map((p) => `${p.nombre}: ${Number(p.stock)} ${p.unidad}`)
      .join(' · ');
  }

  if (tarjeta.accion === 'consultar_cuarto') {
    const c = datos as { numero?: string; estado?: string; nota?: string | null } | null;
    if (!c?.numero) return 'No encontré esa habitación.';
    return `La ${c.numero} está en "${c.estado}".${c.nota ? ` ${c.nota}` : ''}`;
  }

  if (tarjeta.accion === 'buscar_huesped') {
    const lista = (datos ?? []) as Array<{ nombre: string; num_doc: string }>;
    if (lista.length === 0) return 'No hay nadie con ese nombre o documento.';
    return lista
      .slice(0, 5)
      .map((h) => `${h.nombre} (${h.num_doc})`)
      .join(' · ');
  }

  return undefined;
}

export function VistaAsistente({ rol }: { rol: Rol }) {
  const router = useRouter();
  /**
   * `?texto=` deja la frase escrita pero SIN enviar.
   *
   * Llega desde las acciones rápidas del panel de una habitación. No se manda sola a
   * propósito: la persona tiene que ver qué va a pedir antes de pedirlo, sobre todo
   * cuando la frase la escribió un botón y no ella.
   */
  const inicial = useSearchParams().get('texto') ?? '';
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState(inicial);
  const [contexto, setContexto] = useState<ContextoConversacion | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pensando, empezar] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turnos]);

  function enviar(mensaje: string) {
    if (!mensaje.trim() || pensando) return;

    setError(null);
    setTexto('');
    setTurnos((t) => [...t, { quien: 'usuario', texto: mensaje }]);

    empezar(async () => {
      const r = await interpretar(mensaje, contexto);

      if (!r.ok) {
        setError(r.error);
        return;
      }

      const d = r.datos;
      if (d.tipo === 'pregunta') {
        setContexto(d.contexto);
        setTurnos((t) => [...t, { quien: 'asistente', texto: d.pregunta }]);
      } else if (d.tipo === 'tarjeta') {
        setContexto(undefined);
        setTurnos((t) => [...t, { quien: 'tarjeta', tarjeta: d.tarjeta }]);
      } else {
        setContexto(undefined);
        setTurnos((t) => [...t, { quien: 'asistente', texto: d.mensaje }]);
      }
    });
  }

  function confirmar(indice: number, tarjeta: TarjetaAccion) {
    setError(null);
    empezar(async () => {
      const r = await ejecutar(tarjeta);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTurnos((t) =>
        t.map((x, i) =>
          i === indice && x.quien === 'tarjeta'
            ? { ...x, resuelta: 'hecho', respuesta: redactar(tarjeta, r.datos) }
            : x
        )
      );
      router.refresh();
    });
  }

  function descartar(indice: number) {
    setTurnos((t) =>
      t.map((x, i) => (i === indice && x.quien === 'tarjeta' ? { ...x, resuelta: 'descartada' } : x))
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {turnos.length === 0 && (
        <Card padding="p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500">
              <Sparkles className="size-[18px] text-onbrand" />
            </div>
            <div>
              <p className="text-[15px] font-medium">Escribe lo que necesitas.</p>
              <p className="mt-1 text-[13.5px] text-tx-sec">
                Yo preparo la acción y tú solo confirmas. Si me falta un dato, te lo pregunto.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {SUGERENCIAS[rol].map((s) => (
              <button type="button"
                key={s}
                onClick={() => enviar(s)}
                className="rounded-full bg-bg-ter hair px-3.5 py-2 text-[12.5px] text-tx-sec transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {turnos.map((t, i) => {
          if (t.quien === 'usuario') {
            return (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-[13.5px] text-onbrand">
                  {t.texto}
                </p>
              </div>
            );
          }

          if (t.quien === 'asistente') {
            return (
              <div key={i} className="flex justify-start">
                <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surf hair px-4 py-2.5 text-[13.5px]">
                  {t.texto}
                </p>
              </div>
            );
          }

          const { tarjeta, resuelta } = t;
          return (
            <Card key={i} className="up">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[14.5px] font-semibold">{tarjeta.titulo}</p>
                <Chip tono="brand" icono={<Sparkles className="size-3" />}>
                  {tarjeta.origen === 'ia' ? 'Generado por IA' : 'Propuesta'}
                </Chip>
              </div>

              <p className="text-[13.5px] text-tx-sec">{tarjeta.resumen}</p>

              {resuelta === 'hecho' &&
                (t.respuesta ? (
                  <p className="mt-3 rounded-md bg-bg-ter hair px-3 py-2.5 text-[13.5px]">
                    {t.respuesta}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-[13px] text-success">
                    <Check className="size-4" /> Hecho.
                  </p>
                ))}
              {resuelta === 'descartada' && (
                <p className="mt-3 text-[13px] text-tx-muted">Descartada.</p>
              )}

              {!resuelta && (
                <div className="mt-4 flex gap-2">
                  <Boton
                    variante="primario"
                    disabled={pensando}
                    onClick={() => confirmar(i, tarjeta)}
                  >
                    <Check className="size-4" />
                    {tarjeta.requiere_confirmacion ? 'Confirmar' : 'Ver'}
                  </Boton>
                  <Boton variante="fantasma" disabled={pensando} onClick={() => descartar(i)}>
                    <X className="size-4" />
                    Descartar
                  </Boton>
                </div>
              )}
            </Card>
          );
        })}

        {pensando && (
          <div className="flex items-center gap-2 px-1 text-[13px] text-tx-muted">
            <span className="size-1.5 animate-bounce rounded-full bg-tx-muted [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-tx-muted [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-tx-muted" />
          </div>
        )}

        <div ref={finRef} />
      </div>

      {error && <ErrorCaja mensaje={error} />}

      {contexto && (
        <p className="flex items-center gap-1.5 px-1 text-[12px] text-tx-muted">
          <CircleAlert className="size-3.5" />
          Completando un {contexto.accion.replace(/_/g, ' ')}. Escribe «cancelar» para empezar de
          nuevo.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim().toLowerCase() === 'cancelar') {
            setContexto(undefined);
            setTexto('');
            setTurnos((t) => [...t, { quien: 'asistente', texto: 'Listo, empecemos de nuevo.' }]);
            return;
          }
          enviar(texto);
        }}
        className="sticky bottom-24 flex gap-2 lg:bottom-4"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe lo que necesitas…"
          aria-label="Mensaje para el asistente"
          className="card flex-1 rounded-xl bg-surf hair px-4 py-3 text-[14px] text-tx placeholder:text-tx-dis focus:border-brand-500"
        />
        <Boton type="submit" variante="primario" disabled={pensando || !texto.trim()} className="px-4">
          <Send className="size-4" />
        </Boton>
      </form>
    </div>
  );
}
