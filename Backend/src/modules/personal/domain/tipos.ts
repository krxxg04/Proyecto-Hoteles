import type { Rol } from '@/shared/dominio/rol';

export type Perfil = {
  id: string;
  tenant_id: string;
  dni: string;
  nombre: string;
  rol: Rol;
  telefono: string | null;
  activo: boolean;
};
