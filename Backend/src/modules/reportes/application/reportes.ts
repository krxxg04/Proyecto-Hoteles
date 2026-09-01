'use server';

import { exigirSesion, exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import { ESTADOS_CUARTO, type EstadoCuarto } from '@/modules/cuartos/domain/tipos';
import type {
  IngresoDiario,
  LineaConsumo,
  ReporteOcupacion,
  ResumenPanel,
} from '../domain/tipos';
import { uno } from '@/shared/supabase/embebido';
import * as repo from '../infrastructure/repositorio';

const DIAS_SERIE = 14;

/** Los últimos N días en formato `YYYY-MM-DD`, del más viejo al de hoy. */
function ultimosDias(n: number): string[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) =>
    new Date(hoy.getTime() - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10)
  );
}

/** Cuenta por día sobre una lista de marcas de tiempo. Devuelve la serie en orden. */
function serie(dias: string[], marcas: Array<string | null | undefined>): number[] {
  const cuenta = new Map(dias.map((d) => [d, 0]));
  for (const m of marcas) {
    if (!m) continue;
    const dia = m.slice(0, 10);
    if (cuenta.has(dia)) cuenta.set(dia, cuenta.get(dia)! + 1);
  }
  return dias.map((d) => cuenta.get(d)!);
}

/** Las `n` primeras de un recuento por nombre, de mayor a menor. */
function masFrecuentes(
  cuenta: Map<string, { cantidad: number; unidad?: string }>,
  n: number
): LineaConsumo[] {
  return [...cuenta.entries()]
    .map(([nombre, v]) => ({ nombre, cantidad: v.cantidad, unidad: v.unidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, n);
}

/** Todo lo que necesita el panel de inicio, en una llamada. */
export async function resumenPanel(): Promise<Resultado<ResumenPanel>> {
  await exigirSesion();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy.getTime() - 86_400_000);
  const dias = ultimosDias(DIAS_SERIE);

  const datos = await repo.datosDelPanel(
    ayer.toISOString(),
    hoy.toISOString().slice(0, 10),
    `${dias[0]}T00:00:00.000Z`
  );
  if (datos.cuartos.error) return fallo(traducirError(datos.cuartos.error));

  // ---------------------------------------------------------------- cuartos
  const cuartos = (datos.cuartos.data ?? []) as Array<{ estado: EstadoCuarto }>;
  const total = cuartos.length;
  const ocupados = cuartos.filter((c) => c.estado === 'ocupada').length;
  const listas = cuartos.filter((c) => c.estado === 'lista').length;
  const disponibles = cuartos.filter((c) => c.estado === 'lista' || c.estado === 'libre').length;
  const porLimpiar = cuartos.filter((c) =>
    ['limpieza', 'inspeccion', 'checkout'].includes(c.estado)
  ).length;

  // ----------------------------------------------------------------- dinero
  const ventas = (datos.ventas.data ?? []) as Array<{ monto: number; created_at: string }>;
  let ingresosHoy = 0;
  let ingresosAyer = 0;
  let ventasHoy = 0;

  for (const v of ventas) {
    if (new Date(v.created_at) >= hoy) {
      ingresosHoy += Number(v.monto);
      ventasHoy += 1;
    } else {
      ingresosAyer += Number(v.monto);
    }
  }

  // ------------------------------------------------------- consumo y series
  type FilaMovimiento = {
    cantidad: number;
    created_at: string;
    productos: { nombre: string; unidad: string } | { nombre: string; unidad: string }[] | null;
  };
  const movimientos = (datos.movimientos.data ?? []) as unknown as FilaMovimiento[];

  const consumidoPorProducto = new Map<string, { cantidad: number; unidad?: string }>();
  for (const m of movimientos) {
    const producto = uno(m.productos);
    if (!producto) continue;
    const salida = Math.abs(Number(m.cantidad));
    const previo = consumidoPorProducto.get(producto.nombre);
    consumidoPorProducto.set(producto.nombre, {
      cantidad: (previo?.cantidad ?? 0) + salida,
      unidad: producto.unidad,
    });
  }

  type Anidado<T> = T | T[] | null;
  type FilaEstadia = {
    hora_entrada: string;
    hora_salida: string | null;
    cuartos: Anidado<{ tipos_cuarto: Anidado<{ nombre: string }> }>;
  };
  const estadiasSerie = (datos.estadiasSerie.data ?? []) as unknown as FilaEstadia[];

  const porTipo = new Map<string, { cantidad: number }>();
  for (const e of estadiasSerie) {
    const nombre = uno(uno(e.cuartos)?.tipos_cuarto)?.nombre;
    if (!nombre) continue;
    porTipo.set(nombre, { cantidad: (porTipo.get(nombre)?.cantidad ?? 0) + 1 });
  }

  // --------------------------------------------------------------- insumos
  const productos = (datos.productos.data ?? []) as Array<{
    nombre: string;
    unidad: string;
    stock: number;
    stock_max: number;
    stock_min: number;
  }>;

  // Cuenta el mínimo de cada producto; sin mínimo configurado, el 25 % de siempre.
  const stockCritico = productos.filter((p) =>
    Number(p.stock_min) > 0
      ? Number(p.stock) <= Number(p.stock_min)
      : p.stock_max > 0 && p.stock / p.stock_max < 0.25
  ).length;

  /**
   * Cuál hay que reponer antes.
   *
   * Se mide por días de cobertura: dos rollos de papel al día vacían un almacén lleno
   * antes que un jabón que nadie usa. Pero un producto sin consumo registrado **no se
   * descarta**: si está al 18 % es el más urgente aunque no se pueda estimar cuánto
   * dura. Saltárselo por falta de histórico escondía justo lo que había que ver.
   *
   * Manda el que tenga menos días; si ninguno tiene consumo, el de nivel más bajo.
   */
  const candidatos = productos.map((p) => {
    const porDia = (consumidoPorProducto.get(p.nombre)?.cantidad ?? 0) / DIAS_SERIE;
    const min = Number(p.stock_min) || 0;
    return {
      nombre: p.nombre,
      dias: porDia > 0 ? Math.max(0, Math.round(Number(p.stock) / porDia)) : null,
      nivel: p.stock_max > 0 ? Math.round((Number(p.stock) / Number(p.stock_max)) * 100) : 0,
      unidad: p.unidad,
      stock: Number(p.stock),
      stock_min: min,
      bajoMinimo: min > 0 && Number(p.stock) <= min,
    };
  });

  /** Los que ya tocaron su mínimo. Es la alerta que pidió el hostal, y va por delante. */
  const bajoMinimo = candidatos
    .filter((c) => c.bajoMinimo)
    .sort((a, b) => a.stock - a.stock_min - (b.stock - b.stock_min));

  const conDias = candidatos.filter((c) => c.dias !== null).sort((a, b) => a.dias! - b.dias!);
  const porNivel = [...candidatos].sort((a, b) => a.nivel - b.nivel);

  /** Un producto bajo el 25 % gana aunque otro tenga menos días: es el que se queda a cero. */
  const critico = porNivel[0] && porNivel[0].nivel < 25 ? porNivel[0] : null;
  const porAcabarse: ResumenPanel['porAcabarse'] = bajoMinimo[0] ?? critico ?? conDias[0] ?? null;

  return exito({
    cuartos: { total, ocupados, disponibles, listas, porLimpiar },
    ocupacion: total > 0 ? Math.round((ocupados / total) * 100) : 0,
    ingresosHoy,
    ingresosAyer,
    ventasHoy,
    checkinsHoy: estadiasSerie.filter((e) => new Date(e.hora_entrada) >= hoy).length,
    checkoutsHoy: datos.estadias.data?.length ?? 0,
    incidenciasAbiertas: datos.incidencias.data?.length ?? 0,
    stockCritico,
    series: {
      checkins: serie(dias, estadiasSerie.map((e) => e.hora_entrada)),
      checkouts: serie(dias, estadiasSerie.map((e) => e.hora_salida)),
      ventas: serie(dias, ventas.map((v) => v.created_at)),
    },
    consumo: {
      productos: masFrecuentes(consumidoPorProducto, 3),
      tipos: masFrecuentes(porTipo, 4),
    },
    porAcabarse,
    bajoMinimo,
  });
}

export async function mapaCuartos(): Promise<Resultado<Record<EstadoCuarto, number>>> {
  await exigirSesion();

  const { data, error } = await repo.buscarEstadosCuarto();
  if (error) return fallo(traducirError(error));

  const mapa = Object.fromEntries(ESTADOS_CUARTO.map((e) => [e, 0])) as Record<
    EstadoCuarto,
    number
  >;
  for (const fila of data ?? []) mapa[(fila as { estado: EstadoCuarto }).estado] += 1;

  return exito(mapa);
}

/** Ingresos día por día. Alimenta las minigráficas del panel. */
export async function ingresosPorDia(dias = 14): Promise<Resultado<IngresoDiario[]>> {
  await exigirRol(...ROLES_CAJA);

  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  desde.setDate(desde.getDate() - (dias - 1));

  const { data, error } = await repo.buscarVentasDesde(desde.toISOString());
  if (error) return fallo(traducirError(error));

  const porDia = new Map<string, IngresoDiario>();
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde.getTime() + i * 86_400_000);
    const clave = d.toISOString().slice(0, 10);
    porDia.set(clave, { fecha: clave, total: 0, operaciones: 0 });
  }

  for (const fila of data ?? []) {
    const v = fila as { monto: number; created_at: string };
    const dia = porDia.get(v.created_at.slice(0, 10));
    if (dia) {
      dia.total += Number(v.monto);
      dia.operaciones += 1;
    }
  }

  return exito([...porDia.values()]);
}

/** Ocupación del periodo: noches vendidas e ingreso medio por estadía. */
export async function reporteOcupacion(
  desde: string,
  hasta: string
): Promise<Resultado<ReporteOcupacion>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarEstadiasEntre(desde, hasta);
  if (error) return fallo(traducirError(error));

  const estadias = (data ?? []) as Array<{
    modo: string;
    noches: number | null;
    horas: number | null;
    personas: number;
    tarifa_total: number;
  }>;

  const ingresos = estadias.reduce((s, e) => s + Number(e.tarifa_total), 0);

  return exito({
    estadias: estadias.length,
    nochesVendidas: estadias.reduce((s, e) => s + (e.noches ?? 0), 0),
    porHoras: estadias.filter((e) => e.modo === 'horas').length,
    huespedes: estadias.reduce((s, e) => s + e.personas, 0),
    ingresos,
    ticketPromedio:
      estadias.length > 0 ? Math.round((ingresos / estadias.length) * 100) / 100 : 0,
  });
}

/** Solo el administrador. El RLS lo impone; esto solo evita mostrar un botón que iba a fallar. */
export async function auditoriaReciente(limite = 100) {
  await exigirRol('administrador');

  const { data, error } = await repo.buscarAuditoria(limite);
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}
