import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ACCIONES, DESCRIPCION_ACCION, esquemaDe, type Accion } from '../domain/acciones';
import type { Catalogo } from '../domain/tarjeta';
import type { Intencion } from '../domain/reglas';
import type { ProveedorIA } from './proveedor';

/** Adaptador de Claude Haiku. Solo se llama cuando las reglas no reconocieron el comando. */

const MODELO = process.env.MODELO_IA ?? 'claude-haiku-4-5';

/** No entra ni un dato personal: el asistente solo interpreta órdenes operativas. */
const SISTEMA = [
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

/** Las herramientas salen de los mismos esquemas zod que valida el dominio. */
/**
 * Las herramientas que se le ofrecen al modelo.
 *
 * `permitidas` sale del rol de quien pregunta. Recortar la lista aquí no es solo
 * ahorro: un modelo que no ve la herramienta `registrar_checkin` no puede proponerla,
 * así que no hay conversación que empiece a pedir datos para nada.
 */
function herramientas(permitidas: readonly Accion[] = ACCIONES): Anthropic.Tool[] {
  const acciones = permitidas.map((accion) => ({
    name: accion,
    description: DESCRIPCION_ACCION[accion],
    input_schema: z.toJSONSchema(esquemaDe(accion), { io: 'input' }) as Anthropic.Tool.InputSchema,
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

function contexto(catalogo: Catalogo): string {
  const cuartos = catalogo.cuartos.map((c) => c.numero).join(', ') || '(ninguna)';
  const productos = catalogo.productos.map((p) => `${p.nombre} (${p.unidad})`).join(', ') || '(ninguno)';
  return `Habitaciones: ${cuartos}\nProductos: ${productos}`;
}

export function proveedorClaude(): ProveedorIA {
  return {
    nombre: `claude:${MODELO}`,

    async interpretar(texto, catalogo, pendiente, permitidas) {
      const cliente = new Anthropic();

      // Continuando una conversación: se fuerza la misma acción y solo se pide lo que falta.
      const instruccion = pendiente
        ? [
            `Estás completando un ${pendiente.accion} a medias.`,
            `Ya tienes: ${JSON.stringify(pendiente.parametros)}`,
            `Falta: ${pendiente.falta.join(', ')}.`,
            'El mensaje del usuario responde a eso. Devuelve TODOS los campos: los que ya tenías',
            'sin cambiar, más los que puedas deducir del mensaje.',
          ].join('\n')
        : null;

      const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 1024,
        system: [
          // El prefijo estable primero: el catálogo cambia poco y el mensaje va al final.
          { type: 'text', text: SISTEMA },
          { type: 'text', text: contexto(catalogo), cache_control: { type: 'ephemeral' } },
          ...(instruccion ? [{ type: 'text' as const, text: instruccion }] : []),
        ],
        tools: herramientas(permitidas ?? ACCIONES),
        tool_choice: pendiente
          ? { type: 'tool', name: pendiente.accion }
          : { type: 'any' },
        messages: [{ role: 'user', content: texto }],
      });

      const llamada = respuesta.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      if (!llamada || llamada.name === 'no_entiendo') return null;

      if (!(ACCIONES as readonly string[]).includes(llamada.name)) return null;
      const accion = llamada.name as Accion;

      // Se devuelve parcial a propósito: un check-in casi nunca viene completo de un tirón, y
      // quien decide qué falta es zod en la capa de aplicación. La validación estricta —y el
      // descarte de cualquier campo inventado— ocurre al ejecutar, no aquí.
      if (!llamada.input || typeof llamada.input !== 'object') return null;

      return {
        accion,
        parametros: limpiarVacios(llamada.input as Record<string, unknown>),
        confianza: 0.8,
      } satisfies Intencion & { confianza: number };
    },
  };
}

/** `null` si no hay clave: el asistente funciona solo con reglas y lo dice. */
export function proveedorActivo(): ProveedorIA | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return proveedorClaude();
}

/** Un campo nulo o vacío es "no lo sé", no un valor: si no, taparía lo que ya se había recogido. */
function limpiarVacios(obj: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '') salida[k] = v;
  }
  return salida;
}
