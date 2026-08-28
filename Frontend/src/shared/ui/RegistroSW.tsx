'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker. Sin él, Chrome no ofrece instalar la app.
 *
 * Solo en producción: en desarrollo, un worker cacheando `/_next/static` sirve
 * archivos viejos después de cada recompilación y se pierde media tarde buscando
 * por qué un cambio "no se aplica".
 */
export function RegistroSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sin worker la app funciona igual: solo no se puede instalar.
      });
    };

    // Después de `load`: registrarlo antes compite por ancho de banda con la primera pintada.
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
  }, []);

  return null;
}
