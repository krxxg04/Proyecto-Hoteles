import type { Accion } from './acciones';

/** Lo que el hostal tiene ahora mismo, para resolver "la 203" o "toallas" a un id real. */
export type Catalogo = {
  cuartos: Array<{ id: string; numero: string }>;
  productos: Array<{ id: string; nombre: string; categoria: string; unidad: string }>;
};

/**
 * Tarjeta de acción: lo que el asistente propone y una persona confirma.
 *
 * No lleva monto nunca. Al ejecutar, el precio sale del catálogo dentro de la base.
 */
export type TarjetaAccion = {
  accion: Accion;
  titulo: string;
  /** Resumen en una línea, para que la recepcionista lea y confirme. */
  resumen: string;
  parametros: Record<string, unknown>;
  /** Ids ya resueltos. Si falta alguno, `listo` es false. */
  referencias: { cuarto_id?: string; producto_id?: string };
  origen: 'reglas' | 'ia';
  /** 0-1. Las reglas devuelven 1; el LLM, lo que declare. */
  confianza: number;
  /** Escribe en la base, así que exige confirmación explícita. */
  requiere_confirmacion: boolean;
  /** Puede ejecutarse tal cual. Si no, `faltantes` dice qué pedir. */
  listo: boolean;
  faltantes: string[];
};

/**
 * Lo que el cliente devuelve para continuar una conversación a medias.
 *
 * No es autoritativo: al ejecutar se revalida todo contra la base. Vive en el cliente para que
 * el backend siga sin estado.
 */
export type ContextoConversacion = {
  accion: Accion;
  parametros: Record<string, unknown>;
  /** El campo que se acaba de preguntar. La respuesta se lee como ese campo. */
  esperando?: string;
  /**
   * Cuántas veces se ha preguntado ESE mismo campo sin sacar nada.
   *
   * Sin este contador el asistente entra en bucle: "se rompió el espejo del 105" pide
   * el producto, "espejo" no está en el catálogo, y la misma respuesta produce el mismo
   * faltante para siempre. Con dos intentos fallidos se abandona y se dice por qué.
   */
  intentos?: number;
};

export type Interpretacion =
  | { tipo: 'tarjeta'; tarjeta: TarjetaAccion }
  | {
      tipo: 'pregunta';
      pregunta: string;
      /** Devuélvelo tal cual en la siguiente llamada. */
      contexto: ContextoConversacion;
      avance: { completos: string[]; faltantes: string[] };
    }
  | { tipo: 'sin_entender'; mensaje: string; sugerencias: string[] };
