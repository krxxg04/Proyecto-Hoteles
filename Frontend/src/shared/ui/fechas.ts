/**
 * Fechas del hostal, en horario de Lima y con el mismo texto en el servidor y en el navegador.
 *
 * `toLocaleString('es-PE')` no sirve por dos razones. La primera rompe la hidratación: mete
 * un espacio duro entre «p.» y «m.» que cambia según la versión de ICU, y la de Node no es
 * la del navegador. La segunda es peor y no avisa: sin `timeZone`, el servidor formatea en
 * SU zona — en producción, UTC — así que la misma incidencia sale a las 09:21 p. m. en el
 * HTML y a las 04:21 p. m. cuando React rehidrata.
 *
 * Aquí `Intl` solo se usa para obtener los números en hora de Lima; el texto se arma a mano.
 */

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const EN_LIMA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const DIA_INDICE: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partes(entrada: string | Date) {
  const d = typeof entrada === 'string' ? new Date(entrada) : entrada;
  const p = EN_LIMA.formatToParts(d);
  const buscar = (tipo: string) => p.find((x) => x.type === tipo)?.value ?? '';
  return {
    dia: Number(buscar('day')),
    mes: Number(buscar('month')) - 1,
    anio: Number(buscar('year')),
    hora: Number(buscar('hour')),
    minuto: Number(buscar('minute')),
    diaSemana: DIA_INDICE[buscar('weekday')] ?? 0,
  };
}

function reloj(hora: number, minuto: number) {
  const sufijo = hora < 12 ? 'a. m.' : 'p. m.';
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${String(h12).padStart(2, '0')}:${String(minuto).padStart(2, '0')} ${sufijo}`;
}

/** «04:21 p. m.» */
export function hora(entrada: string | Date): string {
  const p = partes(entrada);
  return reloj(p.hora, p.minuto);
}

/** «28 ago., 04:21 p. m.» */
export function fechaYHora(entrada: string | Date): string {
  const p = partes(entrada);
  return `${p.dia} ${MES_CORTO[p.mes]}., ${reloj(p.hora, p.minuto)}`;
}

/** «28 ago. 2026» */
export function fechaCorta(entrada: string | Date): string {
  const p = partes(entrada);
  return `${p.dia} ${MES_CORTO[p.mes]}. ${p.anio}`;
}

/** «viernes, 28 de agosto» */
export function diaYMes(entrada: string | Date): string {
  const p = partes(entrada);
  return `${DIA_LARGO[p.diaSemana]}, ${p.dia} de ${MES_LARGO[p.mes]}`;
}
