import { Cargando } from '@/shared/ui/Cargando';

/** Vale para toda ruta hija que no traiga su propio `loading.tsx`. */
export default function CargandoSeccion() {
  return <Cargando />;
}
