const backendUrl = process.env.RENDER_BACKEND_URL;

if (!backendUrl) {
  console.error('Falta RENDER_BACKEND_URL. Ejemplo: https://hotel-demo-backend.onrender.com');
  process.exit(1);
}

const url = new URL('/api/salud', backendUrl).toString();
const respuesta = await fetch(url, {
  headers: { 'user-agent': 'hotel-demo-keepalive/1.0' },
  signal: AbortSignal.timeout(30_000),
});

if (!respuesta.ok) {
  console.error(`El ping fallo: ${respuesta.status} ${respuesta.statusText}`);
  process.exit(1);
}

console.log(`Backend activo: ${url}`);
