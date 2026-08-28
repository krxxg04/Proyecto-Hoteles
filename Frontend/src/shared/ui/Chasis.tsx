'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Iconos from 'lucide-react';
import type { Sesion } from '@/shared/dominio/tipos';
import {
  ETIQUETA_GRUPO,
  puedeHacerCheckin,
  seccionesDe,
  seccionesMovil,
  type Seccion,
} from './navegacion';
import { ETIQUETA_ROL } from '@/shared/dominio/tipos';
import { Paleta } from './Paleta';
import { CajonCheckin, abrirCheckin } from '@/modules/estadias/ui/CajonCheckin';
import { CajonInspeccion } from '@/modules/estadias/ui/CajonInspeccion';

/** Sidebar agrupado + topbar + bottom nav, como el marco del mockup. */

function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const C = (Iconos as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nombre];
  return C ? <C className={className} /> : null;
}

/**
 * Los dos iconos se pintan siempre y el CSS enseña el que toca según `data-theme`.
 * Sin estado de React: así no hay desajuste de hidratación con el script del layout.
 */
function BotonTema() {
  function alternar() {
    const raiz = document.documentElement;
    const nuevo = raiz.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    // La clase hace que la transición solo corra al conmutar, no en cada hover.
    raiz.classList.add('theming');
    raiz.setAttribute('data-theme', nuevo);
    try {
      localStorage.setItem('tema', nuevo);
    } catch {
      // Modo privado: el tema no se recuerda, pero la app funciona igual.
    }
    setTimeout(() => raiz.classList.remove('theming'), 500);
  }

  return (
    <button
      onClick={alternar}
      aria-label="Cambiar entre tema claro y oscuro"
      className="theme-btn relative grid size-9 place-items-center rounded-md text-tx-sec transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
    >
      <span className="theme-ic moon">
        <Iconos.Moon className="size-[18px]" />
      </span>
      <span className="theme-ic sun">
        <Iconos.Sun className="size-[18px]" />
      </span>
    </button>
  );
}

/**
 * El atajo Ctrl+K tiene que verse: un atajo que nadie descubre no existe.
 * Dispara el mismo evento de teclado que escucha la paleta, para no duplicar el estado.
 */
function abrir() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
}

function BotonBuscar() {
  return (
    <button
      onClick={abrir}
      aria-label="Buscar una acción"
      className="flex items-center gap-2 rounded-md bg-bg-ter hair px-2.5 py-1.5 text-[12.5px] text-tx-muted transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
    >
      <Iconos.Search className="size-[15px]" />
      <span className="hidden sm:inline">Buscar</span>
      <kbd className="hidden sm:inline">Ctrl K</kbd>
    </button>
  );
}

function EnlaceNav({
  seccion,
  activa,
  avisos = 0,
}: {
  seccion: Seccion;
  activa: boolean;
  avisos?: number;
}) {
  return (
    <Link
      href={seccion.ruta}
      aria-current={activa ? 'page' : undefined}
      className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-colors ${
        activa ? 'bg-surf-hover text-tx font-medium' : 'text-tx-sec hover:bg-surf-hover hover:text-tx'
      }`}
    >
      {activa && (
        <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-[3px] bg-brand-500" />
      )}
      <Icono nombre={seccion.icono} className={`size-[17px] ${activa ? 'text-brand-500' : ''}`} />
      {seccion.etiqueta}

      {/* La insignia del mockup: que se vea de un vistazo cuál es la entrada con IA. */}
      {seccion.clave === 'asistente' && (
        <span
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
          style={{ background: 'rgba(124,77,255,.16)', color: '#7C4DFF' }}
        >
          IA
        </span>
      )}
      {seccion.clave === 'alertas' && avisos > 0 && (
        <span className="ml-auto size-2 rounded-full bg-danger" aria-hidden />
      )}
    </Link>
  );
}

export function Chasis({
  sesion,
  incidenciasAbiertas = 0,
  children,
}: {
  sesion: Sesion;
  /** Para el punto rojo de la campana. Sale del panel, no de una consulta aparte. */
  incidenciasAbiertas?: number;
  children: React.ReactNode;
}) {
  const ruta = usePathname();
  const router = useRouter();

  async function salir() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.replace('/login');
    router.refresh();
  }

  const secciones = seccionesDe(sesion.rol);
  const movil = seccionesMovil(sesion.rol);

  const activa = (s: Seccion) => (s.ruta === '/' ? ruta === '/' : ruta.startsWith(s.ruta));
  const actual = secciones.find(activa);

  const grupos = (['operacion', 'gestion', 'administracion'] as const)
    .map((g) => ({ grupo: g, items: secciones.filter((s) => s.grupo === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen">
      <Paleta rol={sesion.rol} />
      {puedeHacerCheckin(sesion.rol) && (
        <>
          <CajonCheckin />
          <CajonInspeccion />
        </>
      )}

      {/* Sidebar — desde lg */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-bg-sec px-3 py-4 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="grid size-8 place-items-center rounded-lg bg-brand-500">
            <Iconos.Hotel className="size-[18px] text-onbrand" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14px] font-semibold">{sesion.hostal ?? 'Hostal'}</p>
            <p className="text-[11.5px] text-tx-muted">
              {sesion.plan === 'premium' ? 'Plan premium' : 'Plan básico'}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {grupos.map(({ grupo, items }) => (
            <div key={grupo}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-tx-muted">
                {ETIQUETA_GRUPO[grupo]}
              </p>
              <div className="flex flex-col gap-0.5">
                {items.map((s) => (
                  <EnlaceNav
                    key={s.clave}
                    seccion={s}
                    activa={activa(s)}
                    avisos={incidenciasAbiertas}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* El mockup repite el buscador al pie: es el mismo Ctrl+K, al alcance del pulgar. */}
        <button
          onClick={abrir}
          aria-label="Buscar una acción"
          className="mt-4 flex items-center gap-2.5 rounded-lg bg-bg-ter hair px-3 py-2.5 text-[13px] text-tx-muted transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
        >
          <Iconos.Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Buscar…</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-bg-ter hair px-3 py-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surf-hover text-[12px] font-semibold">
            {sesion.nombre.slice(0, 1).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium">{sesion.nombre || sesion.dni}</p>
            <p className="text-[11.5px] text-tx-muted">{ETIQUETA_ROL[sesion.rol]}</p>
          </div>
          <button
            onClick={salir}
            aria-label="Cerrar sesión"
            className="grid size-8 place-items-center rounded-md text-tx-muted transition-colors hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <Iconos.LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Topbar */}
      <header className="glass sticky top-0 z-20 hair-b backdrop-blur lg:pl-60">
        <div className="mx-auto flex h-14 max-w-[1536px] items-center gap-3 px-4 sm:px-6">
          <h1 className="text-[17px] font-semibold tracking-tight">{actual?.etiqueta ?? 'Panel'}</h1>
          <span className="hidden text-[12.5px] text-tx-muted sm:block">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <BotonBuscar />

            {/* Campana: lleva a lo que necesita que alguien lo mire. */}
            {secciones.some((s) => s.clave === 'alertas') && (
              <Link
                href="/alertas"
                aria-label={
                  incidenciasAbiertas > 0
                    ? `${incidenciasAbiertas} incidencias sin revisar`
                    : 'Incidencias'
                }
                className="relative grid size-9 place-items-center rounded-md text-tx-sec transition-colors hover:bg-surf-hover hover:text-tx"
              >
                <Iconos.Bell className="size-[18px]" />
                {incidenciasAbiertas > 0 && (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger" />
                )}
              </Link>
            )}

            <BotonTema />

            {/* Acción principal, en la esquina y no en el menú: es la del mockup. */}
            {puedeHacerCheckin(sesion.rol) && (
              <button
                onClick={abrirCheckin}
                className="md-raise ml-1 inline-flex h-9 items-center gap-2 rounded-md bg-brand-500 px-3.5 text-[13px] font-semibold text-onbrand transition-colors hover:bg-brand-600 cursor-pointer"
              >
                <Iconos.Plus className="size-4" />
                <span className="hidden sm:inline">Check-in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1536px] px-4 pt-5 pb-28 sm:px-6 lg:pb-10 lg:pl-[264px]">
        {children}
      </main>

      {/* Bottom nav — solo móvil */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 hair-t backdrop-blur lg:hidden">
        <div className="flex items-stretch justify-around px-2 py-1.5">
          {movil.map((s) => {
            const on = activa(s);
            const esAsistente = s.clave === 'asistente';
            return (
              <Link
                key={s.clave}
                href={s.ruta}
                aria-current={on ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10.5px] transition-colors ${
                  on ? 'text-brand-500 font-medium' : 'text-tx-muted'
                }`}
              >
                {esAsistente ? (
                  <span className="md-raise grid size-9 place-items-center rounded-full bg-brand-500">
                    <Icono nombre={s.icono} className="size-[18px] text-onbrand" />
                  </span>
                ) : (
                  <Icono nombre={s.icono} className="size-[19px]" />
                )}
                <span>{s.etiqueta.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
