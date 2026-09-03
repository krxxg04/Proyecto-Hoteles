import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { ACCIONES, type Accion } from '../domain/acciones';
import type { Intencion } from '../domain/reglas';
import type { ProveedorIA } from './proveedor';
import {
  SISTEMA,
  contexto,
  herramientas,
  instruccionPendiente,
  limpiarVacios,
} from './indicaciones';

/**
 * Adaptador de Claude. Solo se llama cuando las reglas no reconocieron el comando.
 *
 * Dejó de ser el proveedor por defecto en ADR-003 (se pasó a DeepSeek por coste), pero se
 * queda: el puerto `ProveedorIA` existe para tener más de uno, y borrar un camino que
 * funciona para ahorrar un archivo es perder la salida de emergencia.
 */

const MODELO = process.env.MODELO_IA ?? 'claude-haiku-4-5';

export function proveedorClaude(): ProveedorIA {
  return {
    nombre: `claude:${MODELO}`,

    async interpretar(texto, catalogo, pendiente, permitidas) {
      const cliente = new Anthropic();

      const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 1024,
        system: [
          // El prefijo estable primero: el catálogo cambia poco y el mensaje va al final.
          { type: 'text', text: SISTEMA },
          { type: 'text', text: contexto(catalogo), cache_control: { type: 'ephemeral' } },
          // Aquí sí se puede forzar la herramienta, así que no hace falta pedirla por texto.
          ...(pendiente
            ? [{ type: 'text' as const, text: instruccionPendiente(pendiente, false) }]
            : []),
        ],
        tools: herramientas(permitidas ?? ACCIONES),
        tool_choice: pendiente ? { type: 'tool', name: pendiente.accion } : { type: 'any' },
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
