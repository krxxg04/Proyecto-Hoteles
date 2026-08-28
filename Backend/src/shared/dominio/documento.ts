export const TIPOS_DOC = ['DNI', 'Pasaporte', 'Carné de extranjería', 'RUC'] as const;
export type TipoDocumento = (typeof TIPOS_DOC)[number];
