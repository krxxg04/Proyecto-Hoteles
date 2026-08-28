export type Huesped = {
  id: string;
  nombre: string;
  tipo_doc: string;
  num_doc: string;
  telefono: string | null;
  email: string | null;
  nacionalidad: string | null;
  notas: string | null;
  requiere_revision: boolean;
  created_at: string;
};
