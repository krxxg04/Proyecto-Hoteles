import { registrarCompra, entregarACuarto, ajustarStock, movimientosRecientes } from '@/modules/inventario/application/stock';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/inventario?producto=<uuid> -> kardex de movimientos. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return intentar(() => movimientosRecientes(url.searchParams.get('producto') ?? undefined));
}

/** POST /api/inventario -> { tipo: 'compra' | 'entrega' | 'ajuste', ... } */
export async function POST(request: Request) {
  const body = await cuerpo(request);

  switch (body.tipo) {
    case 'compra':
      return intentar(() => registrarCompra(body as never));
    case 'entrega':
      return intentar(() => entregarACuarto(body as never));
    case 'ajuste':
      return intentar(() => ajustarStock(body as never));
    default:
      return intentar(async () => ({
        ok: false as const,
        error: 'Indica el tipo: compra, entrega o ajuste.',
        campo: 'tipo',
      }));
  }
}
