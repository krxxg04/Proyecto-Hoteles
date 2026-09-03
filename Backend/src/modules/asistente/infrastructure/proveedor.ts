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
 * `ADR-001` eligió Claude Haiku; `ADR-003` pasó a DeepSeek por coste. Hay un adaptador
 * por proveedor y `activo.ts` elige — que es exactamente para lo que existe este puerto.
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
