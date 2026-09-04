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
 * El proveedor de IA. Único (ADR-003 y ADR-004), y solo se llama cuando las reglas no
 * reconocieron el comando.
 *
 * Va por el endpoint en **formato Anthropic** que DeepSeek publica, así que se reutiliza
 * el mismo SDK y el mismo formato de herramientas. No es un atajo: la alternativa era
 * traducir los esquemas al formato de OpenAI y mantener esa conversión.
 *
 * Por eso `@anthropic-ai/sdk` sigue en las dependencias aunque ya no haya adaptador de
 * Claude: aquí es el cliente del protocolo que habla DeepSeek, no el de Anthropic.
 *
 * Modelo: `deepseek-v4-flash`, el más barato de su catálogo, con su nombre nativo. Su
 * documentación solo describe pasar alias de Claude por este endpoint, pero el nombre
 * propio funciona —comprobado contra la API— y un alias es una indirección que ellos
 * pueden cambiar sin avisar.
 *
 * Cuatro cosas de su comportamiento, y cada una cambia el código:
 *
 *   0. **Razona por defecto, y sale carísimo.** Devuelve un bloque `thinking` antes de la
 *      herramienta: medido, 634 tokens de salida contra 70 con el razonamiento apagado —
 *      nueve veces más, para la misma respuesta. Y con `max_tokens` corto se lo come
 *      entero y no llega a emitir el `tool_use`, así que el asistente diría "no entendí"
 *      siempre. Para clasificar una frase y rellenar un esquema no aporta nada.
 *
 *   1. `tool_choice: {type:'tool', name}` NO existe: solo `none`, `auto` y `any`. Así que
 *      la acción a medias se pide por texto y se comprueba en la respuesta (abajo).
 *   2. `cache_control` se ignora. No se pierde nada: su caché de contexto es automática y
 *      descuenta el lote — pero el prefijo estable se sigue mandando primero, porque de
 *      eso depende que su caché acierte.
 *   3. `system` como array de bloques no está documentado, solo como string: se une aquí.
 */

const BASE = 'https://api.deepseek.com/anthropic';

const MODELO = process.env.MODELO_IA ?? 'deepseek-v4-flash';

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
        ...(pendiente ? [instruccionPendiente(pendiente)] : []),
      ].join('\n\n');

      const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 1024,
        /**
         * Determinista. La misma frase tiene que dar la misma tarjeta.
         *
         * Sin esto, "se rompió el espejo del 105" salía unas veces como una pregunta por
         * el producto y otras como "no entendí": el espejo no está en el catálogo, la
         * regla no dispara y decide el modelo. Para un guion de demo —y para poder
         * reproducir un fallo que alguien reporta— la variación es un problema, no una
         * gracia. Su documentación lista `temperature` como soportada.
         */
        temperature: 0,
        // Ver el punto 0 de la cabecera: sin esto son nueve veces más tokens de salida
        // para la misma tarjeta, y el riesgo de que el razonamiento agote `max_tokens`.
        thinking: { type: 'disabled' },
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

/**
 * `null` si no hay clave: el asistente funciona solo con reglas, cubre las 9 acciones y lo
 * dice en `GET /api/salud`. Degradar en silencio sería peor — nadie sabría que la mitad
 * del asistente no está viva.
 */
export function proveedorActivo(): ProveedorIA | null {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  return proveedorDeepSeek();
}

/** Para `GET /api/salud`: qué falta, dicho con el nombre exacto de la variable. */
export function faltaClaveIA(): string {
  return 'solo reglas (falta DEEPSEEK_API_KEY)';
}
