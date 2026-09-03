'use server';

import { exigirSesion } from '@/shared/sesion';
import { conOrigen } from '@/shared/origen';
import { exito, fallo, type Resultado } from '@/shared/resultado';
import { normalizar, interpretarConReglas, type Intencion } from '../domain/reglas';
import { extraerCampo } from '../domain/campos';
import {
  ACCIONES_POR_ROL,
  ACCIONES_QUE_ESCRIBEN,
  A_QUIEN_LE_TOCA,
  ETIQUETA_ACCION,
  PREGUNTA_CAMPO,
  SUGERENCIAS_POR_ROL,
  esquemaDe,
  faltantesDe,
  puedeAccion,
  type Accion,
} from '../domain/acciones';
import type {
  Catalogo,
  ContextoConversacion,
  Interpretacion,
  TarjetaAccion,
} from '../domain/tarjeta';
import { cargarCatalogo } from '../infrastructure/catalogo';
import { proveedorActivo } from '../infrastructure/deepseek';

import { registrarVenta } from '@/modules/ventas/application/ventas';
import { registrarCompra, entregarACuarto, ajustarStock } from '@/modules/inventario/application/stock';
import { listarProductos } from '@/modules/inventario/application/catalogo';
import { cambiarEstadoCuarto, obtenerCuarto } from '@/modules/cuartos/application/cuartos';
import { listarHuespedes } from '@/modules/huespedes/application/huespedes';
import { registrarCheckin } from '@/modules/estadias/application/estadias';

/**
 * Asistente híbrido: reglas primero, LLM para lo que no reconocen (ADR-001 §3).
 *
 * Nunca ejecuta por su cuenta. Propone una tarjeta, o pregunta lo que falta, y una persona
 * confirma. Ejecutar es otra llamada, donde se revalida todo porque la tarjeta pasó por el cliente.
 */

export async function interpretar(
  texto: string,
  contexto?: ContextoConversacion
): Promise<Resultado<Interpretacion>> {
  const sesion = await exigirSesion();

  if (!texto?.trim()) return fallo('Escribe qué necesitas.');

  const permitidas = ACCIONES_POR_ROL[sesion.rol];
  const sugerencias = SUGERENCIAS_POR_ROL[sesion.rol];

  const catalogo = await cargarCatalogo();

  const continuacion = contexto?.accion
    ? await continuar(texto, contexto, catalogo, permitidas)
    : null;
  const arranque = continuacion ? null : await arrancar(texto, catalogo, permitidas);

  const paso = continuacion ?? arranque;

  if (!paso) {
    return exito({
      tipo: 'sin_entender',
      mensaje: 'No entendí esa. Puedes decirlo de otra forma o usar el formulario.',
      sugerencias,
    });
  }

  /**
   * El corte va ANTES de preguntar por lo que falta.
   *
   * Si se dejara para el final, el asistente le sacaría a la persona de limpieza el
   * nombre y el documento de un huésped a lo largo de cuatro preguntas para acabar
   * diciéndole que no tiene permiso. Datos personales que nunca iban a usarse.
   */
  if (!puedeAccion(sesion.rol, paso.intencion.accion)) {
    const quien = A_QUIEN_LE_TOCA[paso.intencion.accion];
    return exito({
      tipo: 'sin_entender',
      mensaje: quien
        ? `Eso lo hace ${quien}. Avísale y lo registra en un momento.`
        : 'Eso no entra en lo que puedes hacer desde aquí.',
      sugerencias,
    });
  }

  const faltantes = faltantesDe(paso.intencion.accion, paso.intencion.parametros);

  // Lo que el catálogo no reconoce cuenta como faltante: sin id no hay nada que ejecutar.
  const sinResolver = referenciasSinResolver(paso.intencion, catalogo);
  const pendientes = [...new Set([...faltantes, ...sinResolver])];

  if (pendientes.length > 0) {
    const siguiente = pendientes[0];
    return exito({
      tipo: 'pregunta',
      pregunta: PREGUNTA_CAMPO[siguiente] ?? `¿${siguiente}?`,
      contexto: {
        accion: paso.intencion.accion,
        parametros: paso.intencion.parametros,
        esperando: siguiente,
      },
      avance: {
        completos: Object.keys(paso.intencion.parametros),
        faltantes: pendientes,
      },
    });
  }

  return exito({
    tipo: 'tarjeta',
    tarjeta: armarTarjeta(paso.intencion, catalogo, paso.origen, paso.confianza),
  });
}

// ------------------------------------------------------------ interpretación

type Paso = { intencion: Intencion; origen: TarjetaAccion['origen']; confianza: number };

/** Primer turno: reglas y, si no reconocen, el LLM. */
async function arrancar(
  texto: string,
  catalogo: Catalogo,
  permitidas: Accion[]
): Promise<Paso | null> {
  const porReglas = interpretarConReglas(texto, catalogo);
  if (porReglas) return { intencion: porReglas, origen: 'reglas', confianza: 1 };

  const proveedor = proveedorActivo();
  if (!proveedor) return null;

  try {
    // Al LLM solo se le ofrecen las herramientas que ese rol puede usar.
    const delModelo = await proveedor.interpretar(texto, catalogo, undefined, permitidas);
    if (!delModelo) return null;
    return {
      intencion: { accion: delModelo.accion, parametros: delModelo.parametros },
      origen: 'ia',
      confianza: delModelo.confianza,
    };
  } catch {
    return null; // Si el proveedor falla, el asistente no se cae.
  }
}

/**
 * Turno siguiente: la respuesta se lee como el campo que se preguntó.
 *
 * "dos" o "yape" los resuelve el extractor sin gastar un token; solo si no saca nada entra el LLM.
 */
async function continuar(
  texto: string,
  contexto: ContextoConversacion,
  catalogo: Catalogo,
  permitidas: Accion[]
): Promise<Paso | null> {
  const acumulado = { ...contexto.parametros };
  const campo = contexto.esperando;

  if (campo) {
    const valor = extraerCampo(campo, texto, catalogo);
    if (valor !== null && valor !== undefined && valor !== '') {
      acumulado[campo] = valor;
      return { intencion: { accion: contexto.accion, parametros: acumulado }, origen: 'reglas', confianza: 1 };
    }
  }

  const proveedor = proveedorActivo();
  if (!proveedor) return null;

  try {
    const delModelo = await proveedor.interpretar(
      texto,
      catalogo,
      {
        accion: contexto.accion,
        parametros: acumulado,
        falta: campo ? [campo] : faltantesDe(contexto.accion, acumulado),
      },
      permitidas
    );
    if (!delModelo) return null;

    // Lo que ya estaba manda: el modelo completa, no reescribe.
    return {
      intencion: {
        accion: contexto.accion,
        parametros: { ...delModelo.parametros, ...acumulado },
      },
      origen: 'ia',
      confianza: delModelo.confianza,
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ ejecución

/**
 * Ejecuta una tarjeta que una persona ya confirmó.
 *
 * Todo lo que se escriba aquí queda marcado como `asistente` en el audit_log: sin eso
 * el registro dice que la 105 cambió de estado, pero no si lo pidió la IA o recepción.
 */
export async function ejecutar(tarjeta: TarjetaAccion): Promise<Resultado<unknown>> {
  return conOrigen('asistente', () => despachar(tarjeta));
}

async function despachar(tarjeta: TarjetaAccion): Promise<Resultado<unknown>> {
  await exigirSesion();

  const accion = tarjeta?.accion;
  if (!accion || !(accion in ETIQUETA_ACCION)) return fallo('Acción desconocida.');

  // La tarjeta viajó por el cliente: los ids se resuelven otra vez desde el catálogo y los
  // parámetros se revalidan. Además, cada caso de uso comprueba su rol y el RLS sigue ahí.
  const catalogo = await cargarCatalogo();
  const parsed = esquemaDe(accion).safeParse(tarjeta.parametros);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0] ?? ''));
  }

  const p = parsed.data as Record<string, unknown>;
  const producto = resolverProducto(p.producto as string | undefined, catalogo);
  const cuarto = resolverCuarto(p.cuarto as string | undefined, catalogo);

  switch (accion) {
    case 'registrar_checkin':
      if (!cuarto) return fallo('No reconozco esa habitación.', 'cuarto');
      return registrarCheckin({
        cuarto_id: cuarto.id,
        modo: p.modo as 'rango',
        horas: p.horas as number | null,
        noches: p.noches as number | null,
        personas: p.personas as number,
        nombre: p.nombre as string,
        tipo_doc: p.tipo_doc as 'DNI',
        num_doc: p.num_doc as string,
        telefono: (p.telefono as string) ?? '',
        medio: p.medio as 'efectivo',
        banco: (p.banco as string) ?? null,
        acompanantes: [],
      });

    case 'vender_producto':
      if (!producto) return fallo('No reconozco ese producto.', 'producto');
      return registrarVenta({
        producto_id: producto.id,
        cantidad: p.cantidad as number,
        cuarto_id: cuarto?.id ?? null,
        medio: p.medio as 'efectivo',
      });

    case 'entregar_a_cuarto':
      if (!producto) return fallo('No reconozco ese producto.', 'producto');
      if (!cuarto) return fallo('No reconozco esa habitación.', 'cuarto');
      return entregarACuarto({
        producto_id: producto.id,
        cantidad: p.cantidad as number,
        cuarto_id: cuarto.id,
      });

    case 'registrar_compra':
      if (!producto) return fallo('No reconozco ese producto.', 'producto');
      return registrarCompra({
        producto_id: producto.id,
        cantidad: p.cantidad as number,
        motivo: (p.motivo as string) ?? undefined,
      });

    case 'reportar_danio':
      if (!producto) return fallo('No reconozco ese producto.', 'producto');
      return ajustarStock({
        producto_id: producto.id,
        cantidad: p.cantidad as number,
        tipo: 'danio',
        motivo: p.motivo as string,
      });

    case 'cambiar_estado_cuarto':
      if (!cuarto) return fallo('No reconozco esa habitación.', 'cuarto');
      return cambiarEstadoCuarto({ cuarto_id: cuarto.id, estado: p.estado as 'limpieza' });

    case 'consultar_cuarto':
      if (!cuarto) return fallo('No reconozco esa habitación.', 'cuarto');
      return obtenerCuarto(cuarto.id);

    case 'consultar_stock': {
      const res = await listarProductos();
      if (!res.ok) return res;
      const nombre = p.producto as string | undefined;
      return exito(
        nombre ? res.datos.filter((x) => normalizar(x.nombre) === normalizar(nombre)) : res.datos
      );
    }

    case 'buscar_huesped':
      return listarHuespedes(p.texto as string);
  }
}

// ---------------------------------------------------------------- armado

function referenciasSinResolver(intencion: Intencion, catalogo: Catalogo): string[] {
  const p = intencion.parametros;
  const faltan: string[] = [];

  if (p.producto && !resolverProducto(p.producto as string, catalogo)) faltan.push('producto');
  if (p.cuarto && !resolverCuarto(p.cuarto as string, catalogo)) faltan.push('cuarto');

  return faltan;
}

function armarTarjeta(
  intencion: Intencion,
  catalogo: Catalogo,
  origen: TarjetaAccion['origen'],
  confianza: number
): TarjetaAccion {
  const p = intencion.parametros;
  const producto = resolverProducto(p.producto as string | undefined, catalogo);
  const cuarto = resolverCuarto(p.cuarto as string | undefined, catalogo);

  return {
    accion: intencion.accion,
    titulo: ETIQUETA_ACCION[intencion.accion],
    resumen: resumir(intencion.accion, p, producto?.nombre, cuarto?.numero),
    parametros: { ...p, producto: producto?.nombre ?? p.producto, cuarto: cuarto?.numero ?? p.cuarto },
    referencias: { producto_id: producto?.id, cuarto_id: cuarto?.id },
    origen,
    confianza,
    requiere_confirmacion: ACCIONES_QUE_ESCRIBEN.includes(intencion.accion),
    listo: true,
    faltantes: [],
  };
}

function resumir(
  accion: Accion,
  p: Record<string, unknown>,
  producto?: string,
  cuarto?: string
): string {
  const cant = p.cantidad ? `${p.cantidad} ` : '';
  const nombre = producto ?? (p.producto as string) ?? '';
  const hab = cuarto ?? (p.cuarto as string) ?? '';

  switch (accion) {
    case 'registrar_checkin': {
      const estadia =
        p.modo === 'horas' ? `${p.horas} horas` : p.modo === 'dia' ? 'el día' : `${p.noches} noches`;
      const personas = p.personas === 1 ? '1 persona' : `${p.personas} personas`;
      return `Check-in de ${p.nombre} en la ${hab}: ${estadia}, ${personas}, paga en ${p.medio}. El precio lo calcula el tarifario.`;
    }
    case 'vender_producto':
      return `Cobrar ${cant}${nombre}${hab ? ` a la ${hab}` : ''} en ${p.medio}.`;
    case 'entregar_a_cuarto':
      return `Llevar ${cant}${nombre} a la ${hab}. No se cobra.`;
    case 'registrar_compra':
      return `Ingresar ${cant}${nombre} al inventario.`;
    case 'reportar_danio':
      return `Descontar ${cant}${nombre} por daño o pérdida.`;
    case 'cambiar_estado_cuarto':
      return `Poner la habitación ${hab} en "${p.estado}".`;
    case 'consultar_cuarto':
      return `Ver el estado de la habitación ${hab}.`;
    case 'consultar_stock':
      return nombre ? `Ver cuánto queda de ${nombre}.` : 'Ver el inventario completo.';
    case 'buscar_huesped':
      return `Buscar a "${p.texto}" en el registro de huéspedes.`;
  }
}

function resolverProducto(nombre: string | undefined, catalogo: Catalogo) {
  if (!nombre) return null;
  const n = normalizar(nombre);
  return catalogo.productos.find((x) => normalizar(x.nombre) === n) ?? null;
}

function resolverCuarto(numero: string | undefined | null, catalogo: Catalogo) {
  if (!numero) return null;
  const n = normalizar(String(numero));
  return catalogo.cuartos.find((x) => normalizar(x.numero) === n) ?? null;
}
