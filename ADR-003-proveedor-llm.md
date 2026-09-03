# ADR-003 — Proveedor de LLM: DeepSeek en lugar de Claude Haiku

- **Estado**: aceptado
- **Fecha**: 2026-09-03
- **Reemplaza**: la elección de modelo de `ADR-001 §2` y `§3`. El resto de `ADR-001` sigue vigente.
- **Nota de numeración**: `ESTADO.md §13` reservaba el 003 para el ADR del hosting
  (Render + Vercel), que todavía no se ha escrito. Este ocupa el 003 porque se decide
  ahora; el del hosting pasa a **ADR-004**.

## Contexto

`ADR-001` eligió Claude Haiku para el motor conversacional, con arquitectura híbrida:
reglas primero, LLM solo para lo que las reglas no reconocen. Esa parte no cambia — y es
la que hace que el gasto en LLM sea marginal, porque las reglas absorben casi todo el
tráfico.

El camino de Haiku **nunca se ejecutó**: nunca hubo clave. Así que esto no sustituye algo
que funcionaba; elige el proveedor con el que se va a encender por primera vez.

## Decisión

El proveedor por defecto es **DeepSeek `deepseek-v4-flash`**, por el endpoint en formato
Anthropic (`https://api.deepseek.com/anthropic`).

El adaptador de Claude **se conserva**. `activo.ts` elige: con `DEEPSEEK_API_KEY` usa
DeepSeek, si no y hay `ANTHROPIC_API_KEY` usa Claude, y sin ninguna devuelve `null` y el
asistente funciona solo con reglas.

## Por qué

**Coste.** Precios por millón de tokens, consultados el 2026-09-03:

| | Entrada | Entrada con caché | Salida |
|---|---|---|---|
| Claude Haiku 4.5 | $1.00 | — | $5.00 |
| DeepSeek v4-flash (valle) | $0.22 | $0.007 | $0.66 |
| DeepSeek v4-flash (pico) | $0.44 | $0.014 | $1.32 |

Entre 2,3× y 4,5× más barato en entrada, y entre 3,8× y 7,6× en salida.

**Honestidad sobre la magnitud**: en valor absoluto el ahorro es pequeño, porque el motor
híbrido hace pocas llamadas — `ESTADO.md` estimaba el gasto de Haiku en «céntimos». Lo que
esto compra de verdad es margen para subir el porcentaje de tráfico que va al LLM sin que
el coste sea un argumento en contra.

**No cuesta arquitectura.** El puerto `ProveedorIA` ya existía para esto, y el endpoint en
formato Anthropic permite reutilizar el SDK y el formato de herramientas: no hay que
traducir los esquemas zod al formato de OpenAI ni mantener dos conversiones.

## Consecuencias

### Tres límites de la compatibilidad, y qué se hizo con cada uno

| Límite documentado | Consecuencia |
|---|---|
| `tool_choice: {type:'tool', name}` no existe (solo `none`/`auto`/`any`) | En una conversación a medias la acción se pide por texto y **se verifica en la respuesta**: si el modelo cambia de acción, el adaptador devuelve `null` y la capa de aplicación vuelve a preguntar el campo que falta |
| `cache_control` se ignora | La caché de DeepSeek es automática y descuenta ~97 %. El prefijo estable se sigue mandando primero, porque de eso depende que acierte |
| `system` como array de bloques no está documentado | Se une en un solo string |

### Datos personales fuera del país — lo que cerró este cambio

Al revisarlo salió que el comentario de `claude.ts` («no entra ni un dato personal») era
**falso**: `registrar_checkin` lleva `nombre`, `num_doc` y `telefono`, y la conversación a
medias se reenviaba entera en cada turno, así que el nombre y el DNI del huésped salían
hacia el proveedor en cada mensaje.

Con un proveedor en EE. UU. ya era discutible. Con DeepSeek, que procesa en China, es una
**transferencia internacional de datos personales** — el gate #4 de `CLAUDE.md`
(Ley 29733) trata exactamente de esto.

`indicaciones.ts` ahora sustituye esos tres campos por `(ya registrado)` antes de enviar.
El modelo no los necesita: su trabajo es decidir qué acción es y qué falta, no recordar el
DNI. Aplica a **los dos** proveedores.

**Riesgo residual, y es real**: el mensaje que escribe la persona se manda tal cual. Si
recepción teclea «llegó Carlos Mendoza con DNI 71234567», eso viaja. Cerrarlo requiere una
decisión de producto que este ADR no toma:

- redactar patrones (DNI de 8 dígitos, nombres del catálogo de huéspedes) antes de enviar;
- o no mandar al LLM los mensajes cuyo intento las reglas ya clasificaron como check-in;
- o registrar el consentimiento y la transferencia internacional, que es lo que la ley pide
  cuando el dato sí sale.

Mientras no se resuelva, **el gate #4 sigue abierto** y así queda anotado.

## Alternativas

- **Seguir con Haiku.** Más caro, y sin ventaja funcional demostrada: el camino nunca se
  ejecutó, así que no había calidad medida que perder.
- **DeepSeek por su endpoint de formato OpenAI.** Habría obligado a traducir los esquemas
  de herramientas y a mantener dos formatos. El endpoint en formato Anthropic evita eso.
- **`deepseek-v4-pro`.** Tres veces el precio de `flash` para una tarea de clasificación
  con herramientas, que es lo más fácil que se le puede pedir a un modelo.

## Lo que queda por hacer

1. **No está probado contra la API real**: falta la clave. `GET /api/salud` responde
   `solo reglas (falta DEEPSEEK_API_KEY)` hasta que exista, igual que hacía con Anthropic.
   Los dos límites que importan —`tool_choice: any` y el `system` como string— salen de su
   documentación, no de una corrida.
2. Medir si `flash` mantiene la calidad del motor de reglas en las 9 acciones. Las 16
   frases del motor de reglas no llaman al LLM, así que no sirven de contraste.
3. Resolver el riesgo residual de datos personales de arriba.
