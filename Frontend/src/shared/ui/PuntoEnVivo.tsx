'use client';

import type { EstadoEnVivo } from './useEnVivo';

/**
 * Si dos personas miran la misma pizarra, tienen que saber si lo que ven está vivo.
 * Color más texto, nunca color solo (accesibilidad, ADR-001 §6).
 */
export function PuntoEnVivo({ estado }: { estado: EstadoEnVivo }) {
  const TEXTO: Record<EstadoEnVivo, string> = {
    conectando: 'Conectando…',
    en_vivo: 'En vivo',
    sin_conexion: 'Sin conexión en vivo',
  };

  const COLOR: Record<EstadoEnVivo, string> = {
    conectando: 'var(--tx-muted)',
    en_vivo: '#22C55E',
    sin_conexion: '#F59E0B',
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] text-tx-muted"
      title={
        estado === 'en_vivo'
          ? 'Los cambios de otras personas aparecen solos.'
          : 'Recarga para ver los cambios de otras personas.'
      }
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${estado === 'en_vivo' ? 'animate-pulse' : ''}`}
        style={{ background: COLOR[estado] }}
      />
      {TEXTO[estado]}
    </span>
  );
}
