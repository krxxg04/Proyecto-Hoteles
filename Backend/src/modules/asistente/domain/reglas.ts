import { MEDIOS_PAGO, type MedioPago } from '@/shared/dominio/pago';
import { ESTADOS_CUARTO, type EstadoCuarto } from '@/modules/cuartos/domain/tipos';
import { detectarModo, personasPorPalabra } from './campos';
import type { Accion } from './acciones';
import type { Catalogo } from './tarjeta';

/**
 * Motor de reglas. Puro: texto + catálogo -> intención, sin tocar red ni base.
 *
 * Resuelve el grueso de los comandos sin gastar un token. Lo que no reconoce cae al LLM.
 */

export type Intencion = { accion: Accion; parametros: Record<string, unknown> };

const NUMEROS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

/**
 * El orden importa: "ya está limpia" significa que la limpieza TERMINÓ, no que hay que hacerla.
 * En el flujo actual (ocupada -> inspeccion -> limpieza -> lista) lo siguiente es `lista`:
 * la inspeccion va ANTES de limpiar, no despues. Con el flujo viejo esto decia
 * `inspeccion`, y dejarlo asi mandaria el cuarto hacia atras.
 */
const ESTADO_POR_PALABRA: Array<[RegExp, EstadoCuarto]> = [
  [/\b(ya (esta|quedo)|termine|termino|acabe|acabo|quedo)\b.*\blimpi/, 'lista'],
  [/\blimpi(a|o|ando|eza|ar)\b/, 'limpieza'],
  [/\blist(a|o)\b/, 'lista'],
  [/\bdisponible|libre\b/, 'libre'],
  [/\bocupad(a|o)\b/, 'ocupada'],
  [/\bmantenimiento|averi|malogr/, 'mantenimiento'],
  [/\binspecci/, 'inspeccion'],
  // Salio el huesped: el cuarto va a revision, que es lo que ahora significa inspeccion.
  [/\bcheck ?-?out|salida\b/, 'inspeccion'],
];

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Devuelve `null` cuando ninguna regla aplica: ahí entra el LLM. */
export function interpretarConReglas(texto: string, catalogo: Catalogo): Intencion | null {
  const t = normalizar(texto);
  if (!t) return null;

  const cuarto = detectarCuarto(t, catalogo);
  // El número del cuarto se saca del texto para que no se confunda con una cantidad.
  const sinCuarto = cuarto ? t.replace(cuarto, ' ') : t;

  const producto = detectarProducto(sinCuarto, catalogo);
  const cantidad = detectarCantidad(sinCuarto) ?? 1;
  const medio = detectarMedio(t);
  const estado = detectarEstado(t);
  const esPregunta = /\?/.test(texto) || /^(que|cual|cuanto|cuanta|cuantos|cuantas|quien|donde|esta|hay|se hospedo|tiene)\b/.test(t);

  // --- Consultas primero: si no, "la 105 esta lista" se leería como un cambio de estado.
  if (esPregunta) {
    if (/\bse hospedo|hospedado|estuvo antes|es cliente|conoces a\b/.test(t)) {
      const nombre = limpiarNombre(t.replace(/.*\b(se hospedo|hospedado|estuvo antes|es cliente|conoces a)\b/, ''));
      if (nombre.length >= 2) return { accion: 'buscar_huesped', parametros: { texto: nombre } };
    }
    if (cuarto) return { accion: 'consultar_cuarto', parametros: { cuarto } };
    if (/\bqueda|quedan|hay|stock|inventario\b/.test(t)) {
      return { accion: 'consultar_stock', parametros: { producto: producto ?? null } };
    }
  }

  if (/\bbusca(r)?\b.*\bhuesped|\bbusca a\b/.test(t)) {
    const nombre = limpiarNombre(t.replace(/.*\bbusca(r)? (a )?/, '').replace(/\bhuesped\b/, ''));
    if (nombre.length >= 2) return { accion: 'buscar_huesped', parametros: { texto: nombre } };
  }

  // --- Check-in: la frase suelta ("llego una pareja, doble, 2 noches, efectivo").
  // Solo rellena lo que el texto dice; el resto se pregunta después.
  if (/\bcheck ?-?in|se queda|se quedan|entrada|llego (una|un|el|la)\b.*\b(pareja|senor|senora|chico|chica|persona|cliente|huesped)|hospedar/.test(t)) {
    const parametros: Record<string, unknown> = {};
    /**
     * Se busca sobre `sinCuarto` y sin la duración, o cualquier número de la frase acaba
     * contado como personas: "se queda dos noches en la 205" daba `personas: 205`, que
     * la validación rechaza después con un mensaje que no explica nada.
     */
    const personas =
      personasPorPalabra(t) ?? detectarCantidad(sinCuarto.replace(SIN_DURACION, ' '));
    const modo = detectarModo(t);
    const noches = cantidadAntesDe(t, 'noche');
    const horas = cantidadAntesDe(t, 'hora');

    if (cuarto) parametros.cuarto = cuarto;
    if (modo) parametros.modo = modo;
    if (noches) parametros.noches = noches;
    if (horas) parametros.horas = horas;
    if (personas) parametros.personas = personas;
    if (medio) parametros.medio = medio;

    return { accion: 'registrar_checkin', parametros };
  }

  // --- Escrituras.
  if (/\bse rompio|rompieron|se perdio|perdieron|falta(n)?|dañad|danad|rot(o|a)|malogr/.test(t)) {
    if (producto) {
      return {
        accion: 'reportar_danio',
        parametros: { producto, cantidad, motivo: texto.trim() },
      };
    }
  }

  if (/\bllego|llegaron|compramos|compre|ingreso|entro|recibimos\b/.test(t)) {
    if (producto) return { accion: 'registrar_compra', parametros: { producto, cantidad } };
  }

  if (/\bcobra|cobrale|vende|vendele|venta|paga|pago|pagaron\b/.test(t) || (producto && medio)) {
    if (producto) {
      return {
        accion: 'vender_producto',
        parametros: { producto, cantidad, cuarto: cuarto ?? null, medio: medio ?? 'efectivo' },
      };
    }
  }

  if (/\blleva|llevale|entrega|entregale|sube|subele|manda|mandale\b/.test(t) || (cuarto && producto)) {
    if (cuarto && producto) {
      return { accion: 'entregar_a_cuarto', parametros: { producto, cantidad, cuarto } };
    }
  }

  if (cuarto && estado) {
    return { accion: 'cambiar_estado_cuarto', parametros: { cuarto, estado } };
  }

  return null;
}

export function detectarCuarto(t: string, catalogo: Catalogo): string | null {
  const numeros = t.match(/\b\d{1,4}\b/g) ?? [];
  for (const n of numeros) {
    if (catalogo.cuartos.some((c) => c.numero.toLowerCase() === n)) return n;
  }
  return null;
}

/** Las palabras de `NUMEROS`, listas para meter en una regex. */
const PALABRAS_NUMERO = Object.keys(NUMEROS).join('|');

/**
 * "2 noches" y "dos noches". Antes solo se leía la primera forma.
 *
 * `NUMEROS` ya existía y `detectarCantidad` ya lo usaba, pero la regla de check-in
 * buscaba `/(\d+)\s*noche/` a pelo, así que "dos noches" dejaba el modo en `rango` y
 * las noches sin poner — y el asistente las preguntaba otra vez.
 */
export function cantidadAntesDe(t: string, unidad: string): number | null {
  const digito = t.match(new RegExp(`(\\d+)\\s*${unidad}`));
  if (digito) return Number(digito[1]);

  const palabra = t.match(new RegExp(`\\b(${PALABRAS_NUMERO})\\s+${unidad}`));
  return palabra ? NUMEROS[palabra[1]] : null;
}

/**
 * Quita la duración para que no se cuele como número de personas.
 *
 * Sin esto, "dos noches" sin la palabra "pareja" delante haría que `detectarCantidad`
 * devolviera 2 personas leyendo el "dos" de las noches. La versión vieja solo borraba
 * la forma con dígitos.
 */
export const SIN_DURACION = new RegExp(
  `\\b(\\d+|${PALABRAS_NUMERO})\\s*(noche|hora)\\w*`,
  'g'
);

export function detectarCantidad(t: string): number | null {
  const digito = t.match(/\b(\d{1,3})\b/);
  if (digito) return Number(digito[1]);

  for (const [palabra, valor] of Object.entries(NUMEROS)) {
    if (new RegExp(`\\b${palabra}\\b`).test(t)) return valor;
  }
  return null;
}

/** Coincidencia por palabra: "toallas" encuentra "Toalla de mano". Devuelve el nombre del catálogo. */
export function detectarProducto(t: string, catalogo: Catalogo): string | null {
  let mejor: { nombre: string; puntaje: number } | null = null;

  for (const p of catalogo.productos) {
    const palabras = normalizar(p.nombre).split(' ').filter((w) => w.length >= 4);
    let puntaje = 0;

    for (const palabra of palabras) {
      const raiz = palabra.replace(/(es|s)$/, '');
      if (new RegExp(`\\b${escapar(raiz)}(es|s)?\\b`).test(t)) puntaje += palabra.length;
    }

    if (puntaje > 0 && (!mejor || puntaje > mejor.puntaje)) {
      mejor = { nombre: p.nombre, puntaje };
    }
  }

  return mejor?.nombre ?? null;
}

export function detectarMedio(t: string): MedioPago | null {
  return MEDIOS_PAGO.find((m) => new RegExp(`\\b${m}\\b`).test(t)) ?? null;
}

export function detectarEstado(t: string): EstadoCuarto | null {
  for (const [patron, estado] of ESTADO_POR_PALABRA) {
    if (patron.test(t)) return estado;
  }
  return ESTADOS_CUARTO.find((e) => new RegExp(`\\b${e}\\b`).test(t)) ?? null;
}

/** Quita las muletillas que quedan pegadas al nombre: "antes julia" -> "julia". */
/**
 * Quita lo que la gente pone delante de un nombre.
 *
 * Se exporta porque el extractor de campos lo necesita: cuando el asistente pregunta
 * "¿A nombre de quién?", la respuesta llega como "se llama Rosa Vargas", y guardar eso
 * literal deja al huésped registrado con la muletilla incluida.
 *
 * Sin distinguir mayúsculas: aquí entra el texto tal cual lo escribió la persona, no el
 * normalizado, porque el nombre se guarda con sus tildes y sus mayúsculas.
 */
export function limpiarNombre(s: string): string {
  let n = s.trim();
  const muletillas =
    /^(se llama|a nombre de|el nombre es|se llaman|son|nombre|es|para|antes|alguna vez|aca|aqui|el|la|los|las|sr|sra|senor|senora|don|dona)\s+/i;
  while (muletillas.test(n)) n = n.replace(muletillas, '');
  return n.replace(/\s+/g, ' ').trim();
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
