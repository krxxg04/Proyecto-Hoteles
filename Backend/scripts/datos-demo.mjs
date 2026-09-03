/**
 * Histórico grande para la demo pública (`seed --rica`).
 *
 * El seed normal porta lo que el prototipo tenía en memoria, y eso es lo correcto para
 * desarrollo: contrasta uno a uno contra `index.html`. Pero en una demo deja pantallas
 * mudas — las minigráficas de 14 días dibujan con dos días de datos, Reservas sale vacía
 * y Caja no tiene un solo gasto que mostrar.
 *
 * Aquí no se inventa ninguna pantalla nueva: se rellena con volumen plausible lo que ya
 * existe.
 *
 * Todo sale de un generador con semilla fija, así que dos personas que siembren la demo
 * ven exactamente los mismos números. Un histórico distinto en cada corrida hace
 * imposible escribir un guion de demo.
 */

/** LCG mínimo. No es criptografía: es repetibilidad. */
function generador(semilla) {
  let s = semilla;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const DIA = 24 * 3600 * 1000;

/**
 * Un momento del día `hace` días, a la hora dada.
 *
 * El clamp no es paranoia: restar horas sobre «ahora menos N días» cruzaba la medianoche
 * hacia adelante y sembraba ventas fechadas mañana. Una venta en el futuro descoloca la
 * tarjeta de «hoy vs ayer» y no hay forma de verlo salvo mirando las fechas a mano.
 */
function momento(ahora, hace, hora, minuto = 0) {
  const d = new Date(ahora - hace * DIA);
  d.setHours(hora, minuto, 0, 0);
  return new Date(Math.min(d.getTime(), ahora - 3600 * 1000)).toISOString();
}

/** Cuánto cuesta reponer cada cosa. Sin esto, la alarma de sobreprecio nunca salta. */
export const COSTO_REFERENCIA = {
  'Papel higiénico': 1.2,
  Toallas: 12,
  Sábanas: 28,
  Almohadas: 18,
  'Kit de aseo': 4.5,
  Jabón: 1.8,
  'Agua 500 ml': 1,
  Gaseosa: 2.2,
};

/** Seis huéspedes más, para que Huéspedes y el histórico no sean cuatro filas. */
export const HUESPEDES_EXTRA = [
  { nombre: 'Rosa Ccahuana', tipo_doc: 'DNI', num_doc: '45889012', nacionalidad: 'Peruana', requiere_revision: false, notas: null },
  { nombre: 'Miguel Anticona', tipo_doc: 'DNI', num_doc: '09877654', nacionalidad: 'Peruana', requiere_revision: false, notas: 'Viaja por trabajo cada mes.' },
  { nombre: 'Sofía Delgado', tipo_doc: 'DNI', num_doc: '76543210', nacionalidad: 'Peruana', requiere_revision: false, notas: null },
  { nombre: 'John Baker', tipo_doc: 'Pasaporte', num_doc: 'US-4471902', nacionalidad: 'Estadounidense', requiere_revision: false, notas: null },
  { nombre: 'Lucía Ferrari', tipo_doc: 'Pasaporte', num_doc: 'AR-3390115', nacionalidad: 'Argentina', requiere_revision: false, notas: null },
  { nombre: 'Pedro Huamán', tipo_doc: 'DNI', num_doc: '32109876', nacionalidad: 'Peruana', requiere_revision: true, notas: 'Dejó daños en la visita anterior. Requiere validación humana.' },
];

const VENDIBLES = [
  { nombre: 'Agua 500 ml', precio: 2, peso: 5 },
  { nombre: 'Gaseosa', precio: 4, peso: 3 },
  { nombre: 'Kit de aseo', precio: 8, peso: 1 },
];

const MEDIOS = ['efectivo', 'efectivo', 'efectivo', 'yape', 'yape', 'plin', 'tarjeta'];

/**
 * Ventas de los últimos 14 días.
 *
 * Fin de semana con más movimiento que un martes, porque es lo que hace un hostal. Hoy
 * lleva una venta más que un día normal, pero NO se fuerza a cerrar por encima de ayer:
 * la tarjeta de «vs ayer» puede salir en rojo, y eso también es un día real de hostal.
 */
export function construirVentas({ numerosCuarto, ahora }) {
  const dado = generador(20260903);
  const bolsa = VENDIBLES.flatMap((p) => Array(p.peso).fill(p));
  const filas = [];

  for (let hace = 13; hace >= 0; hace--) {
    const fecha = new Date(ahora - hace * DIA);
    const finDeSemana = [0, 5, 6].includes(fecha.getDay());
    const cuantas = (finDeSemana ? 6 : 4) + Math.floor(dado() * 3) + (hace === 0 ? 1 : 0);

    for (let i = 0; i < cuantas; i++) {
      const p = bolsa[Math.floor(dado() * bolsa.length)];
      const cantidad = p.nombre === 'Kit de aseo' ? 1 : 1 + Math.floor(dado() * 3);
      // Repartidas entre las 9 y las 22: nadie compra gaseosas a las 4 de la mañana.
      const hora = 9 + Math.floor(dado() * 13);

      filas.push({
        producto: p.nombre,
        cantidad,
        monto: cantidad * p.precio,
        medio: MEDIOS[Math.floor(dado() * MEDIOS.length)],
        cuarto: numerosCuarto[Math.floor(dado() * numerosCuarto.length)],
        ts: momento(ahora, hace, hora, Math.floor(dado() * 60)),
      });
    }
  }

  return filas;
}

/**
 * Insumos entregados a habitaciones en los 14 días.
 *
 * No es decoración: sin esto el kardex no cuadra. La demo compra 40 rollos de papel en un
 * gasto y el prototipo termina con 22 — la diferencia tuvo que salir a las habitaciones.
 * Y de paso «Consumo del hostal» deja de tener una sola barra.
 */
const ENTREGADO = {
  'Papel higiénico': 45,
  'Kit de aseo': 6,
  Jabón: 26,
  Toallas: 12,
  Sábanas: 9,
};

export function construirEntregas({ numerosCuarto, ahora }) {
  const dado = generador(4242);
  const filas = [];

  for (const [producto, total] of Object.entries(ENTREGADO)) {
    let quedan = total;
    // De atrás hacia hoy, en trozos pequeños, hasta repartir el total exacto.
    for (let hace = 13; hace >= 0 && quedan > 0; hace--) {
      if (dado() < 0.25) continue;
      const cantidad = Math.min(quedan, 1 + Math.floor(dado() * 4));
      quedan -= cantidad;
      const hora = 8 + Math.floor(dado() * 10);

      filas.push({
        producto,
        cantidad,
        cuarto: numerosCuarto[Math.floor(dado() * numerosCuarto.length)],
        ts: momento(ahora, hace, hora),
      });
    }
    // Lo que no cupo en el reparto se entrega hoy: el total tiene que salir clavado.
    if (quedan > 0) {
      filas.push({
        producto,
        cantidad: quedan,
        cuarto: numerosCuarto[0],
        ts: new Date(ahora - 3 * 3600 * 1000).toISOString(),
      });
    }
  }

  return filas;
}

/**
 * Estadías ya cerradas de los últimos 14 días.
 *
 * Sin ellas el panel dice «Check-outs hoy 0» y el tipo de cuarto más frecuente sale con
 * un 1: es lo que se ve cuando el histórico son tres filas. Dos cierran hoy, a propósito.
 */
export function construirEstadiasCerradas({ cuartos, documentos, ahora }) {
  const dado = generador(777);
  const filas = [];

  for (let hace = 13; hace >= 0; hace--) {
    const cuantas = hace === 0 ? 2 : 1 + Math.floor(dado() * 2);

    for (let i = 0; i < cuantas; i++) {
      const cuarto = cuartos[Math.floor(dado() * cuartos.length)];
      const noches = 1 + Math.floor(dado() * 3);
      const entrada = new Date(ahora - (hace + noches) * DIA);
      const salida = new Date(ahora - hace * DIA);

      filas.push({
        documento: documentos[Math.floor(dado() * documentos.length)],
        cuarto: cuarto.numero,
        noches,
        personas: 1 + Math.floor(dado() * Math.min(3, cuarto.aforo)),
        fecha_entrada: entrada.toISOString().slice(0, 10),
        fecha_salida: salida.toISOString().slice(0, 10),
        hora_entrada: new Date(entrada.getTime() + 15 * 3600 * 1000).toISOString(),
        hora_salida: new Date(salida.getTime() + 11 * 3600 * 1000).toISOString(),
      });
    }
  }

  return filas;
}

/**
 * Reservas en sus cuatro estados, incluida una vencida sin resolver.
 *
 * La vencida no es un descuido del dataset: la pantalla la marca en rojo, y una demo que
 * solo enseña el camino feliz no enseña para qué sirve la pantalla.
 */
export function construirReservas({ ahora }) {
  const dia = (n) => new Date(ahora + n * DIA).toISOString().slice(0, 10);

  return [
    { contacto: 'Elena Paredes', telefono: '+51 987 112 233', tipo: 'Matrimonial', entrada: dia(1), salida: dia(3), personas: 2, estado: 'confirmada', origen: 'directo', notas: 'Llega en el vuelo de la tarde.' },
    { contacto: 'Grupo Andes Tour', telefono: '+51 941 887 665', tipo: 'Estándar', entrada: dia(2), salida: dia(4), personas: 3, estado: 'confirmada', origen: 'agencia', notas: 'Tres personas, una habitación.' },
    { contacto: 'Marco Zevallos', telefono: '+51 933 445 001', tipo: 'Ejecutiva', entrada: dia(5), salida: dia(6), personas: 1, estado: 'pendiente', origen: 'whatsapp', notas: null },
    { contacto: 'Karina Loayza', telefono: '+51 977 223 118', tipo: 'Ejecutiva con Aire', entrada: dia(9), salida: dia(11), personas: 2, estado: 'pendiente', origen: 'directo', notas: 'Pidió cuna.' },
    { contacto: 'Diego Salas', telefono: '+51 999 000 111', tipo: 'Estándar', entrada: dia(-1), salida: dia(1), personas: 1, estado: 'pendiente', origen: 'whatsapp', notas: 'No contesta el teléfono.' },
    { contacto: 'Ruth Ojeda', telefono: '+51 912 333 777', tipo: 'Matrimonial', entrada: dia(-3), salida: dia(-2), personas: 2, estado: 'no_show', origen: 'directo', notas: null },
    { contacto: 'Iván Bravo', telefono: '+51 955 121 212', tipo: 'Jacuzzi', entrada: dia(-5), salida: dia(-4), personas: 2, estado: 'cancelada', origen: 'agencia', notas: 'Canceló el mismo día.' },
  ];
}

/**
 * Tres turnos cerrados con sus gastos.
 *
 * `gastos.turno_id` es `not null`: no hay gasto histórico sin un turno que lo sostenga.
 * Los conteos de cierre cuadran a propósito — el descuadre se prueba a mano cerrando un
 * turno en la demo, no dejándolo ya cocinado.
 *
 * Las alertas NO se declaran aquí: el seed las deriva con la misma regla que
 * `registrar_gasto()` — justificable siempre, y fijo solo si se pasa del 30 % sobre la
 * referencia. Escribirlas a mano sería un formato que se despega del real en cuanto
 * alguien toque el margen. Se quedan sin atender: una bandeja vacía no enseña que existe.
 */
export function construirTurnos({ ahora }) {
  const enElDia = (hace, hora) =>
    new Date(new Date(ahora - hace * DIA).setHours(hora, 0, 0, 0)).toISOString();

  return [
    {
      hace: 3,
      abierto_at: enElDia(3, 7),
      cerrado_at: enElDia(3, 19),
      apertura: 200,
      dejado: 320,
      recaudado: 148,
      por_medio: { efectivo: 120, yape: 20, plin: 8 },
      gastos: [
        { categoria: 'fijo', producto: 'Agua 500 ml', cantidad: 24, monto: 26, medio: 'efectivo', concepto: 'Agua 500 ml · 24 unid.' },
        { categoria: 'justificable', concepto: 'Escobas y recogedor', monto: 38, medio: 'efectivo', justificacion: 'Se rompieron las dos escobas del segundo piso.' },
      ],
    },
    {
      hace: 2,
      abierto_at: enElDia(2, 7),
      cerrado_at: enElDia(2, 19),
      apertura: 320,
      dejado: 410,
      recaudado: 132,
      por_medio: { efectivo: 96, yape: 24, tarjeta: 12 },
      gastos: [
        { categoria: 'fijo', producto: 'Papel higiénico', cantidad: 20, monto: 24, medio: 'efectivo', concepto: 'Papel higiénico · 20 rollos' },
        // 12 kits a S/ 4.50 son S/ 54. Pagar 90 se pasa del 30 % y deja alerta.
        { categoria: 'fijo', producto: 'Kit de aseo', cantidad: 12, monto: 90, medio: 'yape', concepto: 'Kit de aseo · 12 kits' },
      ],
    },
    {
      hace: 1,
      abierto_at: enElDia(1, 7),
      cerrado_at: enElDia(1, 19),
      apertura: 410,
      dejado: 350,
      recaudado: 164,
      por_medio: { efectivo: 128, yape: 20, plin: 16 },
      gastos: [
        { categoria: 'justificable', concepto: 'Gasfitero · fuga en la 203', monto: 120, medio: 'efectivo', justificacion: 'Fuga bajo el lavamanos de la 203. Cobró la visita y el repuesto.' },
      ],
    },
  ];
}

/** Lo que dejó el último turno cerrado. La caja arranca donde la dejaron, no en 100. */
export const CAJA_RICA = { saldo: 350 };
