import { clienteServidor } from '@/shared/supabase/servidor';

/** Todo lo del panel en paralelo: es una sola pantalla, no ocho viajes. */
export async function datosDelPanel(desdeAyer: string, hoy: string, desdeSerie: string) {
  const supabase = await clienteServidor();

  const [cuartos, ventas, estadias, incidencias, productos, movimientos, estadiasSerie] =
    await Promise.all([
      supabase.from('cuartos').select('estado').eq('activo', true),
      supabase.from('ventas').select('monto, created_at').gte('created_at', desdeAyer),
      supabase.from('estadias').select('id').eq('estado', 'activa').lte('fecha_salida', hoy),
      supabase.from('incidencias').select('id').eq('estado', 'abierta'),
      supabase.from('productos').select('nombre, unidad, stock, stock_max, stock_min').eq('activo', true),

      // Lo que salió del almacén: ventas y entregas a cuartos. La cantidad va negativa.
      supabase
        .from('movimientos_inventario')
        .select('cantidad, tipo, created_at, productos(nombre, unidad)')
        .in('tipo', ['venta', 'entrega'])
        .gte('created_at', desdeSerie),

      // Para las series y para el tipo de cuarto más frecuente.
      supabase
        .from('estadias')
        .select('hora_entrada, hora_salida, cuartos(tipos_cuarto(nombre))')
        .gte('hora_entrada', desdeSerie),
    ]);

  return { cuartos, ventas, estadias, incidencias, productos, movimientos, estadiasSerie };
}

export async function buscarEstadosCuarto() {
  const supabase = await clienteServidor();
  return supabase.from('cuartos').select('estado').eq('activo', true);
}

export async function buscarVentasDesde(desde: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('ventas')
    .select('monto, created_at')
    .gte('created_at', desde)
    .order('created_at');
}

export async function buscarEstadiasEntre(desde: string, hasta: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('estadias')
    .select('id, modo, noches, horas, personas, tarifa_total, fecha_entrada')
    .gte('fecha_entrada', desde)
    .lte('fecha_entrada', hasta);
}

export async function buscarAuditoria(limite: number) {
  const supabase = await clienteServidor();
  return supabase
    .from('audit_log')
    .select('id, tabla, operacion, registro_id, actor_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);
}
