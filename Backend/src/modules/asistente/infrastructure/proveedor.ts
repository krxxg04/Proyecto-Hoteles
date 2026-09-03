import type { Accion } from '../domain/acciones';
import type { Catalogo } from '../domain/tarjeta';
import type { Intencion } from '../domain/reglas';

/** Una conversación a medias: qué se está haciendo, qué hay y qué falta. */
export type Pendiente = {
  accion: Accion;
  parametros: Record<string, unknown>;
  falta: string[];
};

/**
 * Puerto del proveedor de IA. El asistente no sabe quién está detrás.
 *
 * `ADR-001` eligió Claude Haiku; `ADR-003` pasó a DeepSeek y `ADR-004` lo dejó como el
 * único. Hoy detrás solo hay `deepseek.ts`.
 *
 * El puerto se queda aunque haya un solo adaptador: es lo que mantiene el LLM fuera de
 * `application/`, como pide ADR-002. Sin él, el caso de uso importaría infraestructura y
 * no habría forma de probarlo sin red.
 */
export type ProveedorIA = {
  nombre: string;
  /** `null` si no entiende. Nunca lanza: si el proveedor falla, el asistente sigue con reglas. */
  interpretar(
    texto: string,
    catalogo: Catalogo,
    pendiente?: Pendiente,
    /** Las únicas herramientas que se le ofrecen. Sale del rol de quien pregunta. */
    permitidas?: Accion[]
  ): Promise<(Intencion & { confianza: number }) | null>;
};
