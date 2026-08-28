import { listarCaracteristicas } from '@/modules/cuartos/application/cuartos';
import { listarBancos } from '@/modules/ventas/application/ventas';
import { intentar } from '@/shared/http';
import { exito } from '@/shared/resultado';

/**
 * GET /api/catalogos -> los catálogos globales que necesitan los formularios.
 *
 * Van juntos porque son dos listas cortas y que no cambian: pedirlas por separado
 * serían dos viajes para pintar un solo formulario.
 */
export async function GET() {
  return intentar(async () => {
    const [caracteristicas, bancos] = await Promise.all([listarCaracteristicas(), listarBancos()]);
    return exito({
      caracteristicas: caracteristicas.ok ? caracteristicas.datos : [],
      bancos: bancos.ok ? bancos.datos : [],
    });
  });
}
