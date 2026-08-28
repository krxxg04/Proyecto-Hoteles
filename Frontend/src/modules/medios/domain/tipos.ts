/** Espejo de `Backend/src/modules/medios/domain/tipos.ts`. El contrato lo fija `/api/openapi`. */

export const TIPOS_MEDIO = ['dni', 'rostro', 'inspeccion', 'incidente', 'clip'] as const;
export type TipoMedio = (typeof TIPOS_MEDIO)[number];

/** Los que exigen consentimiento del huésped antes de subir nada (Ley 29733). */
export const EXIGE_CONSENTIMIENTO: TipoMedio[] = ['dni', 'rostro'];

export type PermisoDeSubida = {
  medio_id: string;
  url: string;
  metodo: 'PUT';
  cabeceras: Record<string, string>;
  expira_en_segundos: number;
};

export type Medio = {
  id: string;
  bucket: string;
  object_key: string;
  mime: string | null;
  bytes: number | null;
  tipo: TipoMedio;
  huesped_id: string | null;
  estadia_id: string | null;
  retener_hasta: string | null;
  created_at: string;
};
