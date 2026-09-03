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
 * Adaptador de DeepSeek. Solo se llama cuando las reglas no reconocieron el comando.
 *
 * Va por el endpoint en **formato Anthropic** que DeepSeek publica, así que se reutiliza
 * el mismo SDK y el mismo formato de herramientas. No es un atajo: la alternativa era
 * traducir los esquemas al formato de OpenAI y mantener dos conversiones.
 *
 * Modelo: DeepSeek mapea los nombres de Claude a los suyos, y Haiku/Sonnet caen en
 * `deepseek-v4-flash`, que es el más barato de su catálogo. Por eso el valor por defecto
 * es un nombre de Claude aunque detrás no haya un Claude — es lo que pide su API.
 *
 * Tres límites documentados de su compatibilidad, y cada uno cambia el código:
 *
 *   1. `tool_choice: {type:'tool', name}` NO existe: solo `none`, `auto` y `any`. Así que
 *      la acción a medias se pide por texto y se comprueba en la respuesta (abajo).
 *   2. `cache_control` se ignora. No se pierde nada: su caché de contexto es automática y
 *      descuenta el lote — pero el prefijo estable se sigue mandando primero, porque de
 *      eso depende que su caché acierte.
 *   3. `system` como array de bloques no está documentado, solo como string: se une aquí.
 */

const BASE = 'https://api.deepseek.com/anthropic';
const MODELO = process.env.MODELO_IA ?? 'claude-haiku-4-5';

export function proveedorDeepSeek(): ProveedorIA {
  return {
    nombre: `deepseek:${MODELO}`,

    async interpretar(texto, catalogo, pendiente, permitidas) {
      const cliente = new Anthropic({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: BASE,
      });

      // El prefijo estable primero: es lo que su caché automática puede reutilizar.
      const sistema = [
        SISTEMA,
        contexto(catalogo),
        ...(pendiente ? [instruccionPendiente(pendiente, true)] : []),
      ].join('\n\n');

      const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 1024,
        system: sistema,
        tools: herramientas(permitidas ?? ACCIONES),
        // `any` obliga a llamar a alguna herramienta, que es lo único que necesitamos:
        // cuál tiene que ser se pide en el texto y se verifica al recibirla.
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: texto }],
      });

      const llamada = respuesta.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      if (!llamada || llamada.name === 'no_entiendo') return null;

      if (!(ACCIONES as readonly string[]).includes(llamada.name)) return null;
      const accion = llamada.name as Accion;

      /**
       * Aquí se paga el límite 1. Sin `tool_choice` forzado, el modelo puede cambiar de
       * acción a mitad de una conversación —«2 noches» durante un check-in interpretado
       * como una venta— y eso mezclaría los datos ya recogidos con otra acción.
       *
       * Devolver `null` no rompe nada: la capa de aplicación vuelve a preguntar el campo
       * que falta, que es lo mismo que hace cuando el modelo no entiende.
       */
      if (pendiente && accion !== pendiente.accion) return null;

      if (!llamada.input || typeof llamada.input !== 'object') return null;

      return {
        accion,
        parametros: limpiarVacios(llamada.input as Record<string, unknown>),
        confianza: 0.8,
      } satisfies Intencion & { confianza: number };
    },
  };
}
