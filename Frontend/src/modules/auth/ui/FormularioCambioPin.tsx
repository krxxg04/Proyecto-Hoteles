'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { cambiarMiPin } from '../infrastructure/acciones';
import { Boton, Campo, ErrorCaja } from '@/shared/ui/primitivos';

/**
 * Cambiar el PIN propio.
 *
 * Vive fuera del grupo `(sesion)` por la misma razón que el login: ese layout redirige
 * aquí cuando el PIN es temporal, y si esta pantalla estuviera dentro se redirigiría a
 * sí misma para siempre.
 */
export function FormularioCambioPin({
  obligatorio,
  destino,
}: {
  obligatorio: boolean;
  destino: string;
}) {
  const router = useRouter();
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [repetido, setRepetido] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | undefined>();
  const [enviando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCampo(undefined);

    if (pinNuevo !== repetido) {
      setError('Los dos PIN nuevos no coinciden.');
      setCampo('repetido');
      return;
    }
    if (pinNuevo === pinActual) {
      setError('El PIN nuevo tiene que ser distinto del actual.');
      setCampo('pinNuevo');
      return;
    }

    empezar(async () => {
      const r = await cambiarMiPin({ pinActual, pinNuevo });
      if (!r.ok) {
        setError(r.error);
        setCampo(r.campo);
        return;
      }
      router.replace(destino);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="md-raise grid size-12 place-items-center rounded-xl bg-brand-500">
            <ShieldCheck className="size-6 text-onbrand" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">
              {obligatorio ? 'Elige tu PIN' : 'Cambiar tu PIN'}
            </h1>
            <p className="mt-1 text-[13.5px] text-tx-sec">
              {obligatorio
                ? 'El PIN que tienes lo puso otra persona. Elige uno que solo sepas tú.'
                : 'Necesitas el PIN actual para cambiarlo.'}
            </p>
          </div>
        </div>

        <form onSubmit={enviar} className="card rounded-xl bg-surf hair p-5">
          <div className="flex flex-col gap-3.5">
            <Campo
              etiqueta={obligatorio ? 'El PIN que te dieron' : 'PIN actual'}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              value={pinActual}
              onChange={(e) => setPinActual(e.target.value)}
              placeholder="••••••"
              error={campo === 'pinActual' ? error ?? undefined : undefined}
            />
            <Campo
              etiqueta="PIN nuevo"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pinNuevo}
              onChange={(e) => setPinNuevo(e.target.value)}
              placeholder="••••••"
              error={campo === 'pinNuevo' ? error ?? undefined : undefined}
            />
            <Campo
              etiqueta="Repite el PIN nuevo"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={repetido}
              onChange={(e) => setRepetido(e.target.value)}
              placeholder="••••••"
              error={campo === 'repetido' ? error ?? undefined : undefined}
            />

            {error && !campo && <ErrorCaja mensaje={error} />}

            <Boton
              type="submit"
              variante="primario"
              disabled={enviando}
              className="mt-1 w-full py-2.5"
            >
              <KeyRound className="size-4" />
              {enviando ? 'Guardando…' : 'Guardar mi PIN'}
            </Boton>
          </div>
        </form>

        <p className="mt-4 text-center text-[12px] text-tx-muted">
          {obligatorio
            ? 'Nadie más, ni quien te dio de alta, puede volver a leerlo. Solo reiniciarlo.'
            : 'Si lo olvidas, un administrador puede reiniciarlo.'}
        </p>
      </div>
    </div>
  );
}
