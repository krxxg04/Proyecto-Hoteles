export const ACCIONES = [
  'registrar_checkin', 'vender_producto', 'entregar_a_cuarto', 'registrar_compra',
  'reportar_danio', 'cambiar_estado_cuarto', 'consultar_cuarto', 'consultar_stock',
  'buscar_huesped',
] as const;
export type Accion = (typeof ACCIONES)[number];

export type TarjetaAccion = {
  accion: Accion;
  titulo: string;
  resumen: string;
  parametros: Record<string, unknown>;
  referencias: { cuarto_id?: string; producto_id?: string };
  origen: 'reglas' | 'ia';
  confianza: number;
  requiere_confirmacion: boolean;
  listo: boolean;
  faltantes: string[];
};

export type ContextoConversacion = {
  accion: Accion;
  parametros: Record<string, unknown>;
  esperando?: string;
  /** Intentos fallidos sobre ese campo. Ver el tipo del backend. */
  intentos?: number;
};

export type Interpretacion =
  | { tipo: 'tarjeta'; tarjeta: TarjetaAccion }
  | {
      tipo: 'pregunta';
      pregunta: string;
      contexto: ContextoConversacion;
      avance: { completos: string[]; faltantes: string[] };
    }
  | { tipo: 'sin_entender'; mensaje: string; sugerencias: string[] };
