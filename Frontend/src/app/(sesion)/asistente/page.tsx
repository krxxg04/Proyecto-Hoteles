import { VistaAsistente } from '@/modules/asistente/ui/VistaAsistente';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Asistente() {
  const sesion = await exigirSeccion('asistente');

  return <VistaAsistente rol={sesion.rol} />;
}
