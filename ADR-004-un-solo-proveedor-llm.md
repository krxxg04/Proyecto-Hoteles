# ADR-004 — Un solo proveedor de LLM: DeepSeek, y se borran los demás adaptadores

- **Estado**: aceptado
- **Fecha**: 2026-09-03
- **Reemplaza**: la parte de `ADR-003 §Decisión` que decía «el adaptador de Claude **se conserva**».
  El resto de `ADR-003` —por qué DeepSeek, los precios, los tres límites de su
  compatibilidad y el asunto de los datos personales— sigue vigente.

## Contexto

`ADR-003` eligió DeepSeek y dejó el adaptador de Claude como alternativa. Después se
escribió un tercero para Groq, con la idea de validar el camino del LLM sin poner tarjeta.

Al medir el coste real esa razón se cayó. El payload que manda el asistente son **5 546
caracteres** —unos 1 400-1 700 tokens de entrada, de los que el 80 % son los esquemas de
las 9 herramientas— y la respuesta son 80-150 tokens. A los precios de `deepseek-v4-flash`
eso es **entre $0.0002 y $0.001 por llamada**: validar el chat entero cuesta céntimos.

Mantener dos adaptadores más para ahorrar eso no se sostiene.

## Decisión

**DeepSeek `deepseek-v4-flash` es el único proveedor.** Se borran `claude.ts` y `groq.ts`.

El módulo queda en cuatro archivos:

```
proveedor.ts      el puerto
indicaciones.ts   prompt, catálogo, herramientas y la redacción de datos personales
deepseek.ts       el adaptador, y `proveedorActivo()`
catalogo.ts       de dónde salen los cuartos y productos que ve el modelo
```

`activo.ts` desaparece: elegir entre un solo candidato no necesita un archivo, y
`proveedorActivo()` vuelve a vivir junto al adaptador, como estaba antes de `ADR-003`.

## Por qué se conserva el puerto con un solo adaptador

Porque no está ahí para elegir proveedor, sino para que el LLM no entre en
`application/`, que es lo que pide `ADR-002`. Sin el puerto, el caso de uso importaría
infraestructura y no habría forma de probarlo sin red.

## Por qué `@anthropic-ai/sdk` sigue en las dependencias

Ya no hay adaptador de Claude, pero DeepSeek publica un endpoint en **formato Anthropic**
(`https://api.deepseek.com/anthropic`) y es el que usamos. Ahí ese paquete es el cliente
del protocolo que habla DeepSeek, no el de Anthropic. Está anotado en la cabecera de
`deepseek.ts` para que nadie lo borre creyendo que quedó huérfano.

## Consecuencias

- **Menos código**: `claude.ts` (68 líneas), `groq.ts` (118) y `activo.ts` (30) fuera.
- **Un solo prompt que afinar.** Con varios adaptadores, afinar el prompt en uno los
  desalinea; era la razón de extraer `indicaciones.ts` y ahora es un problema que no existe.
- **`instruccionPendiente()` pierde su parámetro.** `exigirHerramienta` existía porque
  Anthropic y Groq sí pueden forzar una herramienta concreta y DeepSeek no. Con un solo
  proveedor la respuesta es siempre la misma: se pide por texto y se verifica al recibir.
- **Cambiar de proveedor cuesta más que antes.** Es la contrapartida y se acepta: sería
  escribir un adaptador nuevo contra el mismo puerto, que es media hora de trabajo, no un
  rediseño. Prefiero pagar eso el día que pase que mantener dos caminos muertos hasta
  entonces.
- **El riesgo residual de datos personales de `ADR-003` sigue abierto** y no lo toca esta
  decisión: el mensaje que teclea recepción se manda tal cual, y si contiene un nombre y
  un DNI, viaja.

## Alternativas

- **Dejar Claude como respaldo.** Es lo que decía `ADR-003`. Un respaldo que nunca se ha
  ejecutado —falta la clave desde el primer día— no es un respaldo, es código sin probar
  que da la sensación de tener una salida.
- **Quedarse con Groq para pruebas gratis.** Su única ventaja era no poner tarjeta;
  medido el coste, no compensa mantener una segunda traducción de esquemas al formato de
  OpenAI.
