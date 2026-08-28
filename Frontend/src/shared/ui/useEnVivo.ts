'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clienteNavegador } from '@/shared/supabase/navegador';

export type EstadoEnVivo = 'conectando' | 'en_vivo' | 'sin_conexion';

/**
 * Escucha los cambios de una tabla y vuelve a pedir los datos al servidor.
 *
 * El caso real: recepción pone la 203 en limpieza y la persona de limpieza, con la
 * tablet en la mano, tiene que verlo sin recargar nada.
 *
 * No se aplica el cambio con lo que llega por el socket: se llama a `router.refresh()`
 * y los datos vuelven a salir del backend. Así el RLS y las reglas de negocio siguen
 * siendo la única fuente de verdad, y no hay dos versiones del estado que puedan
 * separarse. Cuesta un viaje más; a cambio, lo que se ve es siempre lo que hay.
 *
 * El Realtime de Supabase respeta el RLS: sin sesión no llega nada, y con sesión solo
 * llega lo del propio hostal. Lo comprueba `scripts/prueba-aislamiento.mjs`.
 */
export function useEnVivo(tabla: string): EstadoEnVivo {
  const router = useRouter();
  // Si no hay cliente no hay nada que conectar: se sabe antes del primer render,
  // así que es el estado inicial y no un efecto que dispara un render de más.
  const [estado, setEstado] = useState<EstadoEnVivo>(() =>
    clienteNavegador() ? 'conectando' : 'sin_conexion'
  );
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = clienteNavegador();
    if (!supabase) return;

    // Una ráfaga de cambios (un check-in toca cuarto, estadía y venta) no debe
    // disparar cinco recargas seguidas.
    const refrescarPronto = () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => router.refresh(), 250);
    };

    let canal: ReturnType<typeof supabase.channel> | null = null;
    let vigente = true;

    /**
     * El token de Supabase dura una hora y un turno de recepción dura más. Sin volver a
     * pasárselo al socket en cada refresco, el canal se queda mudo a media jornada y
     * nadie se entera: la pantalla simplemente deja de actualizarse sola.
     */
    const { data: escucha } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (sesion?.access_token) supabase.realtime.setAuth(sesion.access_token);
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vigente) return;

      if (!data.session) {
        setEstado('sin_conexion');
        return;
      }
      supabase.realtime.setAuth(data.session.access_token);

      canal = supabase
        .channel(`en-vivo:${tabla}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, refrescarPronto)
        .subscribe((estadoCanal) => {
          if (!vigente) return;
          if (estadoCanal === 'SUBSCRIBED') setEstado('en_vivo');
          else if (estadoCanal === 'CHANNEL_ERROR' || estadoCanal === 'TIMED_OUT') {
            setEstado('sin_conexion');
          }
        });
    })();

    return () => {
      vigente = false;
      escucha.subscription.unsubscribe();
      if (temporizador.current) clearTimeout(temporizador.current);
      if (canal) supabase.removeChannel(canal);
    };
  }, [tabla, router]);

  return estado;
}
