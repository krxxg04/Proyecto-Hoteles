import type { Rol } from '@/shared/dominio/tipos';

/**
 * Navegación por rol. Portada de `ROLE_NAV` del mockup, sin lo premium: integraciones,
 * integraciones y la corona quedan fuera del plan básico.
 *
 * Esto es UX, no seguridad: quien manda es el RLS. Aquí solo se evita mostrar un botón
 * que iba a fallar.
 */

export type Seccion = {
  clave: string;
  ruta: string;
  etiqueta: string;
  icono: string;
  grupo: 'operacion' | 'gestion' | 'administracion';
};

/**
 * El check-in no está aquí a propósito: en el mockup vive en la esquina superior
 * derecha, como acción principal, no como una entrada más del menú. Sigue siendo una
 * sección para la guardia de rutas y para Ctrl+K — solo no se lista en la barra.
 */
export const SECCION_CHECKIN = 'checkin';

/**
 * Tampoco se lista: en el mockup la inspección se abre desde las acciones rápidas de
 * una habitación (`openInspeccion()`), no desde la barra. Se inspecciona un cuarto
 * concreto mientras se lo está mirando.
 */
export const SECCION_INSPECCION = 'inspeccion';

export const SECCIONES: Seccion[] = [
  { clave: 'inicio', ruta: '/', etiqueta: 'Panel', icono: 'LayoutDashboard', grupo: 'operacion' },
  { clave: 'asistente', ruta: '/asistente', etiqueta: 'Asistente IA', icono: 'Sparkles', grupo: 'operacion' },
  { clave: 'habitaciones', ruta: '/habitaciones', etiqueta: 'Habitaciones', icono: 'BedDouble', grupo: 'operacion' },
  { clave: 'inventario', ruta: '/inventario', etiqueta: 'Inventario', icono: 'Package', grupo: 'operacion' },
  { clave: 'caja', ruta: '/caja', etiqueta: 'Caja', icono: 'Wallet', grupo: 'operacion' },
  { clave: 'limpieza', ruta: '/limpieza', etiqueta: 'Limpieza', icono: 'BrushCleaning', grupo: 'operacion' },
  { clave: 'alertas', ruta: '/alertas', etiqueta: 'Alertas', icono: 'ShieldAlert', grupo: 'operacion' },
  { clave: 'huespedes', ruta: '/huespedes', etiqueta: 'Huéspedes', icono: 'Users', grupo: 'gestion' },
  { clave: 'reservas', ruta: '/reservas', etiqueta: 'Reservas', icono: 'CalendarCheck', grupo: 'gestion' },
  { clave: 'admin-productos', ruta: '/admin/productos', etiqueta: 'Productos', icono: 'Boxes', grupo: 'administracion' },
  { clave: 'admin-personas', ruta: '/admin/personas', etiqueta: 'Personas', icono: 'UserCog', grupo: 'administracion' },
  { clave: 'admin-cuartos', ruta: '/admin/cuartos', etiqueta: 'Cuartos', icono: 'DoorOpen', grupo: 'administracion' },
];

export const ETIQUETA_GRUPO: Record<Seccion['grupo'], string> = {
  operacion: 'Operación',
  gestion: 'Gestión',
  administracion: 'Administración',
};

/**
 * Qué ve cada rol. Es `ROLE_NAV` del prototipo, tal cual, sin lo premium
 * (integraciones y lo premium quedan fuera).
 *
 * `checkin` e `inspeccion` no estaban en el mockup como secciones porque allí eran
 * ventanas que se abrían desde cualquier sitio. Aquí son rutas, y van con quien
 * maneja el dinero: `registrar_checkin` exige rol de caja en la propia base.
 */
const PERMITIDAS: Record<Rol, string[]> = {
  // `SECCION_CHECKIN` va aparte: no está en `SECCIONES` porque no se lista en el menú.
  administrador: [...SECCIONES.map((s) => s.clave), SECCION_CHECKIN, SECCION_INSPECCION],
  recepcion: [
    'inicio', 'asistente', 'habitaciones', 'checkin', 'inspeccion',
    'inventario', 'caja', 'limpieza', 'alertas', 'huespedes', 'reservas',
  ],
  limpieza: ['asistente', 'habitaciones', 'inventario', 'limpieza'],
  mantenimiento: ['asistente', 'habitaciones', 'inventario', 'alertas', 'limpieza'],
};

/**
 * Quiénes manejan dinero. Espejo de `ROLES_CAJA` del backend y de `r_caja()` en SQL.
 *
 * Se repite a propósito: aquí decide qué botones se pintan, allá decide qué se
 * ejecuta. Si alguna vez se separan, manda la base — esto solo evita ofrecer un
 * botón que iba a fallar.
 */
export function esDeCaja(rol: Rol): boolean {
  return rol === 'administrador' || rol === 'recepcion';
}

/** Dónde aterriza cada rol al entrar. */
export const INICIO_POR_ROL: Record<Rol, string> = {
  administrador: '/',
  recepcion: '/',
  limpieza: '/habitaciones',
  mantenimiento: '/habitaciones',
};

export function seccionesDe(rol: Rol): Seccion[] {
  const permitidas = PERMITIDAS[rol] ?? [];
  return SECCIONES.filter((s) => permitidas.includes(s.clave));
}

/** ¿Va el botón de check-in en la esquina para este rol? */
export function puedeHacerCheckin(rol: Rol): boolean {
  return puedeVer(rol, SECCION_CHECKIN);
}

/** Las cuatro de la barra inferior en móvil. */
export function seccionesMovil(rol: Rol): Seccion[] {
  const suyas = seccionesDe(rol);
  const orden = ['inicio', 'habitaciones', 'asistente', 'inventario', 'caja'];
  return orden
    .map((c) => suyas.find((s) => s.clave === c))
    .filter((s): s is Seccion => !!s)
    .slice(0, 5);
}

/** ¿Ese rol tiene esta sección? Misma lista que el menú: una sola fuente de verdad. */
export function puedeVer(rol: Rol, clave: string): boolean {
  return (PERMITIDAS[rol] ?? []).includes(clave);
}
