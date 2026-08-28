import { resumenPanel } from '@/modules/reportes/application/reportes';
import { intentar } from '@/shared/http';

/** GET /api/panel -> todo lo del panel de inicio en una llamada */
export async function GET() {
  return intentar(() => resumenPanel());
}
