import { z } from 'zod';
import { MEDIOS_PAGO } from '@/shared/dominio/pago';
import { TIPOS_DOC } from '@/shared/dominio/documento';
import { ESTADOS_CUARTO } from '@/modules/cuartos/domain/tipos';
import { MODOS_ESTADIA } from '@/modules/estadias/domain/tipos';
import type { Rol } from '@/shared/dominio/rol';

/**
 * Catálogo de acciones del asistente. Deliberadamente corto: el plan básico.
 *
 * Ninguna acción lleva monto. El precio lo pone la base al ejecutar, igual que en el formulario.
 */

export const ACCIONES = [
  'registrar_checkin',
  'vender_producto',
  'entregar_a_cuarto',
  'registrar_compra',
  'reportar_danio',
  'cambiar_estado_cuarto',
  'consultar_cuarto',
  'consultar_stock',
  'buscar_huesped',
] as const;
export type Accion = (typeof ACCIONES)[number];

/** Las que escriben en la base exigen confirmación humana explícita. */
export const ACCIONES_QUE_ESCRIBEN: Accion[] = [
  'registrar_checkin',
  'vender_producto',
  'entregar_a_cuarto',
  'registrar_compra',
  'reportar_danio',
  'cambiar_estado_cuarto',
];

/** El asistente nombra cuartos y productos como los nombra una persona; el id se resuelve después. */
const PARAMETROS = {
  /**
   * El asistente de 4 pasos en una frase. Los refinements solo corren si el objeto base pasa,
   * así que los campos se piden por tandas: primero lo básico, luego lo que depende del modo.
   */
  registrar_checkin: z
    .object({
      cuarto: z.string().min(1),
      modo: z.enum(MODOS_ESTADIA),
      horas: z.coerce.number().int().positive().max(24).optional().nullable(),
      noches: z.coerce.number().int().positive().max(60).optional().nullable(),
      personas: z.coerce.number().int().min(1).max(12).default(1),
      nombre: z.string().min(2),
      tipo_doc: z.enum(TIPOS_DOC).default('DNI'),
      num_doc: z.string().min(6),
      telefono: z.string().optional().nullable(),
      medio: z.enum(MEDIOS_PAGO),
      banco: z.string().optional().nullable(),
    })
    .refine((d) => d.modo !== 'horas' || (d.horas ?? 0) > 0, {
      message: 'Indica cuántas horas',
      path: ['horas'],
    })
    .refine((d) => d.modo !== 'rango' || (d.noches ?? 0) > 0, {
      message: 'Indica cuántas noches',
      path: ['noches'],
    })
    .refine((d) => d.medio !== 'tarjeta' || !!d.banco, {
      message: 'Indica el banco de la tarjeta',
      path: ['banco'],
    }),

  vender_producto: z.object({
    producto: z.string().min(1),
    cantidad: z.coerce.number().positive().default(1),
    cuarto: z.string().optional().nullable(),
    medio: z.enum(MEDIOS_PAGO).default('efectivo'),
  }),
  entregar_a_cuarto: z.object({
    producto: z.string().min(1),
    cantidad: z.coerce.number().positive().default(1),
    cuarto: z.string().min(1),
  }),
  registrar_compra: z.object({
    producto: z.string().min(1),
    cantidad: z.coerce.number().positive(),
    motivo: z.string().optional(),
  }),
  /**
   * `tipo` distingue lo que el esquema ya distinguia y el asistente no usaba: el enum
   * `tipo_movimiento` tiene `danio` y `perdida` desde el primer dia, y aqui se mandaba
   * siempre `danio`. Los dos restan stock igual, pero el kardex decia "dano" cuando una
   * toalla se habia perdido — y eso cambia lo que se hace despues: un dano se repone,
   * una perdida repetida en la misma habitacion se investiga.
   */
  reportar_danio: z.object({
    producto: z.string().min(1),
    cantidad: z.coerce.number().positive().default(1),
    tipo: z.enum(['danio', 'perdida']).default('danio'),
    motivo: z.string().min(3),
  }),
  cambiar_estado_cuarto: z.object({
    cuarto: z.string().min(1),
    estado: z.enum(ESTADOS_CUARTO),
  }),
  consultar_cuarto: z.object({ cuarto: z.string().min(1) }),
  consultar_stock: z.object({ producto: z.string().optional().nullable() }),
  buscar_huesped: z.object({ texto: z.string().min(2) }),
} as const;

export function esquemaDe(accion: Accion) {
  return PARAMETROS[accion];
}

export const ETIQUETA_ACCION: Record<Accion, string> = {
  registrar_checkin: 'Check-in',
  vender_producto: 'Vender producto',
  entregar_a_cuarto: 'Entregar a la habitación',
  registrar_compra: 'Registrar compra',
  reportar_danio: 'Reportar daño o pérdida',
  cambiar_estado_cuarto: 'Cambiar estado de habitación',
  consultar_cuarto: 'Consultar habitación',
  consultar_stock: 'Consultar inventario',
  buscar_huesped: 'Buscar huésped',
};

/** Descripciones para el LLM. En español: los comandos llegan en español. */
export const DESCRIPCION_ACCION: Record<Accion, string> = {
  registrar_checkin:
    'Registrar la entrada de un huésped. Ej: "llegó una pareja, doble, 2 noches, efectivo". ' +
    'Rellena solo lo que diga el mensaje; lo que falte se le preguntará después.',
  vender_producto: 'Cobrar un producto a un huésped. Ej: "2 aguas a la 203, con yape".',
  entregar_a_cuarto: 'Llevar un insumo a una habitación sin cobrar. Ej: "a la 203 dos toallas".',
  registrar_compra: 'Entró mercadería al hostal. Ej: "llegaron 24 aguas".',
  reportar_danio:
    'Algo se rompió, se perdió o falta. Ej: "se rompió un vaso en la 105". ' +
    'Usa tipo="perdida" si desapareció o falta, y tipo="danio" si se rompió o se dañó.',
  cambiar_estado_cuarto: 'Cambiar el estado de una habitación. Ej: "la 105 ya está limpia".',
  consultar_cuarto: 'Preguntar por el estado de una habitación. Ej: "¿la 105 está lista?".',
  consultar_stock: 'Preguntar cuánto queda de un producto. Ej: "¿cuánta agua hay?".',
  buscar_huesped: 'Buscar a una persona por nombre o documento. Ej: "¿se hospedó antes Julia?".',
};

/** Cómo se le pregunta a una persona por un campo que falta. */
export const PREGUNTA_CAMPO: Record<string, string> = {
  cuarto: '¿Qué habitación?',
  producto: '¿Qué producto?',
  cantidad: '¿Cuántos?',
  medio: '¿Cómo paga? (efectivo, yape, plin o tarjeta)',
  banco: '¿De qué banco es la tarjeta?',
  estado: '¿En qué estado lo dejo?',
  motivo: '¿Qué pasó? Escribe el motivo.',
  modo: '¿Por horas, por el día o por noches?',
  horas: '¿Cuántas horas?',
  noches: '¿Cuántas noches?',
  personas: '¿Cuántas personas?',
  nombre: '¿A nombre de quién?',
  num_doc: '¿Cuál es su número de documento?',
  tipo_doc: '¿Qué documento presenta? (DNI, Pasaporte, Carné de extranjería o RUC)',
  telefono: '¿Tiene teléfono de contacto?',
  texto: '¿A quién busco?',
};

/**
 * Qué falta para poder ejecutar. Sale de los propios esquemas zod, así que no hay una segunda
 * lista de campos obligatorios que se pueda desincronizar.
 */
export function faltantesDe(accion: Accion, parametros: Record<string, unknown>): string[] {
  const parsed = esquemaDe(accion).safeParse(parametros);
  if (parsed.success) return [];

  const campos = parsed.error.issues
    .map((i) => String(i.path[0] ?? ''))
    .filter((c) => c && c in PREGUNTA_CAMPO);

  return [...new Set(campos)];
}

/**
 * Qué puede pedirle cada rol al asistente.
 *
 * No es cosmético ni redundante con el resto: sin esto, el asistente le sacaba a la
 * persona de limpieza el nombre y el DNI de un huésped a lo largo de cuatro preguntas
 * para, al confirmar, responder "no tienes permiso". Además de inútil, recogía un dato
 * personal que nunca iba a poder usarse — y la Ley 29733 no perdona pedir datos
 * "por si acaso".
 *
 * La lista es el reflejo de lo que la base ya exige: `registrar_checkin` y
 * `registrar_venta` piden rol de caja en SQL, y `08_acciones_por_rol.sql` hizo lo mismo
 * con las compras. Aquí solo se evita empezar una conversación que iba a terminar mal.
 */
export const ACCIONES_POR_ROL: Record<Rol, Accion[]> = {
  administrador: [...ACCIONES],
  recepcion: [...ACCIONES],
  limpieza: [
    'entregar_a_cuarto',
    'reportar_danio',
    'cambiar_estado_cuarto',
    'consultar_cuarto',
    'consultar_stock',
  ],
  mantenimiento: [
    'entregar_a_cuarto',
    'reportar_danio',
    'cambiar_estado_cuarto',
    'consultar_cuarto',
    'consultar_stock',
  ],
};

export function puedeAccion(rol: Rol, accion: Accion): boolean {
  return ACCIONES_POR_ROL[rol].includes(accion);
}

/** Quién sí puede hacerla, para poder decirle a la persona a quién acudir. */
export const A_QUIEN_LE_TOCA: Partial<Record<Accion, string>> = {
  registrar_checkin: 'recepción',
  vender_producto: 'recepción',
  registrar_compra: 'administración o recepción',
  buscar_huesped: 'recepción',
};

/** Ejemplos para los chips de la interfaz, con lo que ese rol sí puede pedir. */
export const SUGERENCIAS_POR_ROL: Record<Rol, string[]> = {
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
