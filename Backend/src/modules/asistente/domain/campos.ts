import { TIPOS_DOC } from '@/shared/dominio/documento';
import { MODOS_ESTADIA, type ModoEstadia } from '@/modules/estadias/domain/tipos';
import {
  normalizar,
  detectarCantidad,
  detectarCuarto,
  detectarEstado,
  detectarMedio,
  detectarProducto,
} from './reglas';
import type { Catalogo } from './tarjeta';

/**
 * Lee UN campo de una respuesta suelta: "dos", "yape", "la 203", "2 noches".
 *
 * Es la mitad barata del multi-turno. Solo cuando esto no saca nada se molesta al LLM.
 */
export function extraerCampo(
  campo: string,
  texto: string,
  catalogo: Catalogo
): unknown | null {
  const t = normalizar(texto);
  if (!t) return null;

  switch (campo) {
    case 'cuarto':
      return detectarCuarto(t, catalogo);

    case 'producto':
      return detectarProducto(t, catalogo);

    case 'cantidad':
    case 'personas':
      return detectarCantidad(t) ?? personasPorPalabra(t);

    case 'horas': {
      const m = t.match(/(\d+)\s*h/);
      return m ? Number(m[1]) : detectarCantidad(t);
    }

    case 'noches': {
      const m = t.match(/(\d+)\s*noche/);
      return m ? Number(m[1]) : detectarCantidad(t);
    }

    case 'medio':
      return detectarMedio(t);

    case 'estado':
      return detectarEstado(t);

    case 'modo':
      return detectarModo(t);

    case 'tipo_doc':
      return TIPOS_DOC.find((d) => t.includes(normalizar(d))) ?? null;

    case 'num_doc': {
      const m = texto.match(/\b[0-9A-Za-z-]{6,20}\b/);
      return m ? m[0] : null;
    }

    case 'telefono': {
      const m = texto.replace(/\s/g, '').match(/\+?\d{6,15}/);
      return m ? m[0] : null;
    }

    case 'banco':
      return texto.trim() || null;

    // Texto libre: se toma tal cual, con mayúsculas y tildes.
    case 'nombre':
    case 'motivo':
    case 'texto':
      return texto.trim().length >= 2 ? texto.trim() : null;
  }

  return null;
}

export function detectarModo(t: string): ModoEstadia | null {
  if (/\bnoche|noches\b/.test(t)) return 'rango';
  if (/\bhora|horas\b/.test(t)) return 'horas';
  if (/\bamanecida|el dia|un dia|dia completo\b/.test(t)) return 'dia';
  return MODOS_ESTADIA.find((m) => new RegExp(`\\b${m}\\b`).test(t)) ?? null;
}

/** "una pareja" son dos personas; "solo" es una. */
export function personasPorPalabra(t: string): number | null {
  if (/\bpareja|matrimonio|dos personas\b/.test(t)) return 2;
  if (/\bsol(o|a)\b|una persona|individual\b/.test(t)) return 1;
  return null;
}
