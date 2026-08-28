'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Iconos from 'lucide-react';
import type { Rol } from '@/shared/dominio/tipos';
import { ETIQUETA_GRUPO, seccionesDe } from './navegacion';
import { abrirCheckin } from '@/modules/estadias/ui/CajonCheckin';

/**
 * Command palette (Ctrl+K). Portado del prototipo.
 *
 * Solo ofrece lo que el rol puede ver: sale de la misma lista que el menú, así que no
 * hay dos sitios donde recordar quién ve qué. Sigue siendo UX, no seguridad — quien
 * manda es el RLS.
 */

type Comando = {
  id: string;
  etiqueta: string;
  icono: string;
  grupo: string;
  /** Palabras por las que también debería encontrarse. */
  alias?: string;
  hacer: () => void;
};

function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const C = (Iconos as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nombre];
  return C ? <C className={className} /> : null;
}

/**
 * Sin tildes y en minúsculas: se escribe "inspeccion" y aparece "Inspección".
 * `NFD` separa la tilde de la letra, y aquí se tiran los signos sueltos (U+0300-U+036F).
 */
function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((c) => {
      const codigo = c.charCodeAt(0);
      return codigo < 0x0300 || codigo > 0x036f;
    })
    .join('');
}

export function Paleta({ rol }: { rol: Rol }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [activo, setActivo] = useState(0);
  const entradaRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const comandos = useMemo<Comando[]>(() => {
    const ir = (ruta: string) => () => router.push(ruta);
    const secciones = seccionesDe(rol);

    const navegar: Comando[] = secciones.map((s) => ({
      id: `nav:${s.clave}`,
      etiqueta: s.etiqueta,
      icono: s.icono,
      grupo: ETIQUETA_GRUPO[s.grupo],
      hacer: ir(s.ruta),
    }));

    const puede = (clave: string) => secciones.some((s) => s.clave === clave);

    const acciones: Comando[] = [];

    if (puede('checkin')) {
      acciones.push({
        id: 'accion:checkin',
        etiqueta: 'Nuevo check-in',
        icono: 'LogIn',
        grupo: 'Acciones',
        alias: 'registrar huesped entrada llegada',
        // Abre el cajón encima, no navega: es lo mismo que el botón de la esquina.
        hacer: abrirCheckin,
      });
    }
    if (puede('inspeccion')) {
      acciones.push({
        id: 'accion:inspeccion',
        etiqueta: 'Iniciar una inspección',
        icono: 'ClipboardList',
        grupo: 'Acciones',
        alias: 'revisar cuarto checkout faltantes',
        hacer: ir('/inspeccion'),
      });
    }
    acciones.push({
      id: 'accion:asistente',
      etiqueta: 'Preguntarle al asistente',
      icono: 'Sparkles',
      grupo: 'Acciones',
      alias: 'ia chat comando hablar',
      hacer: ir('/asistente'),
    });

    const sistema: Comando[] = [
      {
        id: 'sistema:tema',
        etiqueta: 'Cambiar el tema claro / oscuro',
        icono: 'SunMoon',
        grupo: 'Sistema',
        alias: 'modo noche dia oscuro claro',
        hacer: () => {
          const raiz = document.documentElement;
          const nuevo = raiz.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
          raiz.classList.add('theming');
          raiz.setAttribute('data-theme', nuevo);
          try {
            localStorage.setItem('tema', nuevo);
          } catch {
            // Modo privado: no se recuerda, pero se aplica.
          }
          setTimeout(() => raiz.classList.remove('theming'), 500);
        },
      },
      {
        id: 'sistema:salir',
        etiqueta: 'Cerrar sesión',
        icono: 'LogOut',
        grupo: 'Sistema',
        alias: 'salir logout desconectar',
        hacer: async () => {
          await fetch('/api/auth', { method: 'DELETE' });
          router.replace('/login');
          router.refresh();
        },
      },
    ];

    return [...acciones, ...navegar, ...sistema];
  }, [rol, router]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return comandos;
    return comandos.filter((c) =>
      normalizar(`${c.etiqueta} ${c.grupo} ${c.alias ?? ''}`).includes(q)
    );
  }, [busqueda, comandos]);

  /**
   * Cerrar limpia la búsqueda aquí y no en un efecto: hacerlo al reaccionar a `abierta`
   * obliga a un render de más cada vez, y además se olvidaba de que hay cuatro maneras
   * distintas de cerrar esto.
   */
  const cerrar = useCallback(() => {
    setAbierta(false);
    setBusqueda('');
    setActivo(0);
  }, []);

  // Ctrl+K abre y cierra. En Mac es Cmd+K, que es lo que la gente tiene en los dedos.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierta((v) => {
          if (v) {
            setBusqueda('');
            setActivo(0);
          }
          return !v;
        });
      }
      if (e.key === 'Escape') cerrar();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [cerrar]);

  useEffect(() => {
    if (abierta) entradaRef.current?.focus();
  }, [abierta]);

  // Que el resaltado no se salga de la vista al bajar con el teclado.
  useEffect(() => {
    listaRef.current?.querySelector('[data-activo="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  function ejecutar(comando: Comando | undefined) {
    if (!comando) return;
    cerrar();
    comando.hacer();
  }

  if (!abierta) return null;

  let grupoPrevio = '';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscador de acciones"
        className="pop w-full max-w-lg overflow-hidden rounded-2xl bg-surf-float hair"
        style={{ boxShadow: 'var(--elev-8)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 hair-b">
          <Iconos.Search className="size-[18px] shrink-0 text-tx-muted" />
          <input
            ref={entradaRef}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setActivo(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActivo((i) => Math.min(i + 1, visibles.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActivo((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                ejecutar(visibles[activo]);
              }
            }}
            placeholder="¿Qué necesitas hacer?"
            aria-label="Buscar una acción"
            aria-activedescendant={visibles[activo]?.id}
            className="flex-1 bg-transparent text-[14.5px] text-tx outline-none placeholder:text-tx-dis"
          />
          <kbd>esc</kbd>
        </div>

        <div ref={listaRef} role="listbox" aria-label="Acciones" className="max-h-[52vh] overflow-y-auto p-2">
          {visibles.length === 0 && (
            <p className="px-3 py-8 text-center text-[13.5px] text-tx-muted">
              Nada coincide con «{busqueda}».
            </p>
          )}

          {visibles.map((c, i) => {
            const encabezado = c.grupo !== grupoPrevio ? c.grupo : null;
            grupoPrevio = c.grupo;
            const on = i === activo;
            return (
              <div key={c.id}>
                {encabezado && (
                  <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-tx-muted">
                    {encabezado}
                  </p>
                )}
                <button
                  id={c.id}
                  role="option"
                  aria-selected={on}
                  data-activo={on}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => ejecutar(c)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] transition-colors cursor-pointer ${
                    on ? 'bg-surf-hover text-tx' : 'text-tx-sec'
                  }`}
                >
                  <Icono nombre={c.icono} className={`size-[17px] ${on ? 'text-brand-500' : ''}`} />
                  {c.etiqueta}
                  {on && <Iconos.CornerDownLeft className="ml-auto size-3.5 text-tx-muted" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
