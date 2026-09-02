'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Hotel, LogIn } from 'lucide-react';
import { iniciarSesion } from '../infrastructure/acciones';
import { Boton, Campo, ErrorCaja } from '@/shared/ui/primitivos';
import { INICIO_POR_ROL } from '@/shared/ui/navegacion';

/** Login con DNI y PIN, igual que el prototipo. El personal nunca ve el email sintético. */
export function FormularioLogin() {
  const router = useRouter();
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState('');
  const [hostal, setHostal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | undefined>();
  const [enviando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await iniciarSesion({ dni, pin, hostal: hostal || undefined });
      if (!r.ok) {
        setError(r.error);
        setCampo(r.campo);
        return;
      }
      router.replace(INICIO_POR_ROL[r.datos.rol] ?? '/');
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="md-raise grid size-12 place-items-center rounded-xl bg-brand-500">
            <Hotel className="size-6 text-onbrand" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">Hostal Inteligente</h1>
            <p className="mt-1 text-[13.5px] text-tx-sec">Entra con tu DNI y tu PIN</p>
          </div>
        </div>

        <form onSubmit={enviar} className="card rounded-xl bg-surf hair p-5">
          <div className="flex flex-col gap-3.5">
            <Campo
              etiqueta="DNI"
              inputMode="numeric"
              autoComplete="username"
              autoFocus
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="40123456"
              error={campo === 'dni' ? error ?? undefined : undefined}
            />
            <Campo
              etiqueta="PIN"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••"
              error={campo === 'pin' ? error ?? undefined : undefined}
            />

            {/*
              El campo del hostal aparece solo cuando el servidor lo pide: el mismo DNI puede
              trabajar en dos hostales, y antes se elegía uno arbitrariamente. Pedirlo siempre
              sería estorbar al 99 % de la gente, que solo trabaja en uno.
            */}
            {campo === 'hostal' && (
              <Campo
                etiqueta="Hostal"
                autoFocus
                value={hostal}
                onChange={(e) => setHostal(e.target.value)}
                placeholder="aurora"
                error={error ?? undefined}
              />
            )}

            {error && !campo && <ErrorCaja mensaje={error} />}

            <Boton type="submit" variante="primario" disabled={enviando} className="mt-1 w-full py-2.5">
              <LogIn className="size-4" />
              {enviando ? 'Entrando…' : 'Entrar'}
            </Boton>
          </div>
        </form>

        <p className="mt-4 text-center text-[12px] text-tx-muted">
          ¿Olvidaste tu PIN? Pídele al administrador que lo reinicie.
        </p>
      </div>
    </div>
  );
}
