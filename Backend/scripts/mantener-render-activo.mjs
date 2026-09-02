/**
 * Mantiene despiertos el backend Y la base.
 *
 * Render duerme un servicio gratuito tras ~15 minutos sin tráfico, y un proyecto Supabase
 * del plan gratuito **se pausa tras 7 días sin actividad**. El ping tiene que tocar las
 * dos cosas: antes solo miraba variables de entorno, así que el backend quedaba caliente
 * y la base se dormía igual — la demo aparecía caída sin motivo aparente.
 *
 * `?db=1` es lo que hace la consulta. El health check de Render sigue pegando a
 * `/api/salud` sin parámetro: si dependiera de la base, un hipo de Supabase haría que
 * Render reinicie un servicio sano.
 *
 * Prográmalo cada 10 minutos desde un pinger externo (cron-job.org, UptimeRobot):
 * Render no trae cron en el plan gratuito y el de Vercel Hobby corre una vez al día.
 */

const backendUrl = process.env.RENDER_BACKEND_URL;

if (!backendUrl) {
  console.error('Falta RENDER_BACKEND_URL. Ejemplo: https://hotel-demo-backend.onrender.com');
  process.exit(1);
}

const url = new URL('/api/salud?db=1', backendUrl).toString();

let respuesta;
try {
  respuesta = await fetch(url, {
    headers: { 'user-agent': 'hotel-demo-keepalive/2.0' },
    // Generoso a propósito: si el servicio estaba dormido, el arranque en frío de Render
    // se lleva 50 segundos largos y abortar antes contaría como caída.
    signal: AbortSignal.timeout(90_000),
  });
} catch (e) {
  console.error(`No se pudo alcanzar ${url}: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

if (!respuesta.ok) {
  console.error(`El ping falló: ${respuesta.status} ${respuesta.statusText}`);
  process.exit(1);
}

const cuerpo = await respuesta.json().catch(() => null);

// Que el servicio responda no basta: si la consulta a Postgres falló, la base sigue
// dormida y esto tiene que salir con error para que el pinger lo reporte.
if (!cuerpo?.base?.ok) {
  console.error(`El backend responde pero la base no: ${cuerpo?.base?.error ?? 'sin detalle'}`);
  process.exit(1);
}

console.log(`Backend y base activos · Postgres respondió en ${cuerpo.base.ms} ms`);
