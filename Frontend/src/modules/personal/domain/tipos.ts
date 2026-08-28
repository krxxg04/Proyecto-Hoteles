import type { Rol } from '@/shared/dominio/tipos';

export type Perfil = {
  id: string;
  tenant_id: string;
  dni: string;
  nombre: string;
  rol: Rol;
  telefono: string | null;
  activo: boolean;
};
