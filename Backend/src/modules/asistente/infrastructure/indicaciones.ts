import 'server-only';
import { z } from 'zod';
import { ACCIONES, DESCRIPCION_ACCION, esquemaDe, type Accion } from '../domain/acciones';
import type { Catalogo } from '../domain/tarjeta';
import type { Pendiente } from './proveedor';

/**
 * Lo que se le manda a un LLM, sea cual sea el proveedor.
 *
 * Vivía dentro del adaptador de Claude. Al entrar un segundo proveedor había que elegir
 * entre duplicarlo o sacarlo: duplicado, el día que alguien afine el prompt lo afina en
 * un solo proveedor y los dos dejan de comportarse igual.
 */

/** Herramienta en el formato de la API de Anthropic, que es el que hablan los dos proveedores. */
export type Herramienta = {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
};

export const SISTEMA = [
  'Eres el asistente operativo de un hostal en Perú. Traduces lo que escribe el personal de',
  'recepción o limpieza a UNA acción del sistema, llamando exactamente a una herramienta.',
  '',
  'Reglas:',
  '- Usa siempre el nombre exacto del producto y el número exacto de habitación que aparecen',
  '  en la lista que te doy. Si lo que piden no está en la lista, llama a `no_entiendo`.',
  '- Nunca inventes precios ni montos: no existe ese campo y el sistema los calcula solo.',
  '- Si el mensaje es ambiguo o no corresponde a ninguna acción, llama a `no_entiendo`.',
  '- El español es peruano y coloquial ("amanecida", "sencillo", "yape", "plin").',
].join('\n');

/**
 * Los campos que identifican a una persona y NO se le mandan al proveedor.
 *
 * El comentario que había aquí decía que no entraba ningún dato personal, y era falso:
 * `registrar_checkin` lleva nombre, documento y teléfono, y la conversación a medias se
 * reenviaba entera en cada turno. Con eso el nombre y el DNI del huésped salían del país
 * en cada mensaje — el gate #4 de CLAUDE.md (Ley 29733) trata exactamente de esto.
 *
 * El modelo no los necesita: su trabajo es decidir QUÉ acción es y qué falta todavía, no
 * recordar el DNI. Se le dice que el campo ya está resuelto y se queda igual de informado.
 */
const IDENTIFICAN = ['nombre', 'num_doc', 'telefono'] as const;

export function sinDatosPersonales(parametros: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(parametros)) {
    salida[clave] = (IDENTIFICAN as readonly string[]).includes(clave) ? '(ya registrado)' : valor;
  }
  return salida;
}

/**
 * Las herramientas que se le ofrecen al modelo.
 *
 * `permitidas` sale del rol de quien pregunta. Recortar la lista aquí no es solo ahorro:
 * un modelo que no ve la herramienta `registrar_checkin` no puede proponerla, así que no
 * hay conversación que empiece a pedir datos para nada.
 */
export function herramientas(permitidas: readonly Accion[] = ACCIONES): Herramienta[] {
  const acciones = permitidas.map((accion) => ({
    name: accion,
    description: DESCRIPCION_ACCION[accion],
    input_schema: z.toJSONSchema(esquemaDe(accion), { io: 'input' }) as Herramienta['input_schema'],
  }));

  return [
    ...acciones,
    {
      name: 'no_entiendo',
      description: 'El mensaje no corresponde a ninguna acción, o falta información esencial.',
      input_schema: {
        type: 'object',
        properties: { razon: { type: 'string', description: 'Qué falta o por qué no aplica.' } },
        required: ['razon'],
      },
    },
  ];
}

export function contexto(catalogo: Catalogo): string {
  const cuartos = catalogo.cuartos.map((c) => c.numero).join(', ') || '(ninguna)';
  const productos = catalogo.productos.map((p) => `${p.nombre} (${p.unidad})`).join(', ') || '(ninguno)';
  return `Habitaciones: ${cuartos}\nProductos: ${productos}`;
}

/**
 * La instrucción de una conversación a medias.
 *
 * `exigirHerramienta` existe porque los dos proveedores no se comportan igual: Anthropic
 * acepta `tool_choice: {type:'tool'}` y fuerza la acción, y DeepSeek solo admite `any`.
 * Donde no se puede forzar, se pide por texto y se comprueba la respuesta.
 */
export function instruccionPendiente(pendiente: Pendiente, exigirHerramienta: boolean): string {
  return [
    `Estás completando un ${pendiente.accion} a medias.`,
    `Ya tienes: ${JSON.stringify(sinDatosPersonales(pendiente.parametros))}`,
    `Falta: ${pendiente.falta.join(', ')}.`,
    'El mensaje del usuario responde a eso. Devuelve TODOS los campos: los que ya tenías',
    'sin cambiar, más los que puedas deducir del mensaje.',
    ...(exigirHerramienta ? [`Llama obligatoriamente a la herramienta \`${pendiente.accion}\`.`] : []),
  ].join('\n');
}

/** Un campo nulo o vacío es "no lo sé", no un valor: si no, taparía lo que ya se había recogido. */
export function limpiarVacios(obj: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '' && v !== '(ya registrado)') salida[k] = v;
  }
  return salida;
}
