# Deploy demo: Render + Vercel

Guía pensada para dejar una demo funcional rápido:

- `Render` para `Backend/`
- `Vercel` para `Frontend/`
- `Supabase` como base de datos

## 1. Base de datos

Antes de desplegar, en Supabase aplica los SQL en este orden:

1. `Database/01_schema.sql`
2. `Database/02_auth_y_auditoria.sql`
3. `Database/03_logica_negocio.sql`
4. `Database/04_permisos_service_role.sql`
5. `Database/05_origen_y_realtime.sql`
6. `Database/06_ejecucion_de_funciones.sql`
7. `Database/07_medios_en_inspecciones.sql`
8. `Database/08_acciones_por_rol.sql`
9. `Database/09_esperado_no_negativo.sql`
10. `Database/10_stock_minimo_y_bajas.sql`
11. `Database/11_cuartos_solo_el_estado.sql`
12. `Database/12_caja_unica_y_gastos.sql`
13. `Database/13_turnos_con_caja_unica.sql`

Si usarás PIN cortos, en Supabase baja el mínimo de contraseña o usa PIN de 6 dígitos.

## 2. Backend en Render

Puedes crear el servicio manualmente o importando [`render.yaml`](./render.yaml).

Configuración base:

- Root Directory: `Backend`
- Runtime: `Node`
- Build Command: `npm install && npm run build`
- Pre-Deploy Command: `npm run migrar:nube`
- Start Command: `npm run start`
- Health Check Path: `/api/salud`

Variables obligatorias en Render:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `DEMO_HOSTAL_NOMBRE`
- `DEMO_HOSTAL_SLUG`
- `DEMO_ADMIN_DNI`
- `DEMO_ADMIN_NOMBRE`
- `DEMO_ADMIN_PIN`

Variables opcionales:

- `DEMO_HOSTAL_CIUDAD=Lima`
- `DEMO_RESEED=0`
- `DEEPSEEK_API_KEY`
- `MODELO_IA`
- `HABILITAR_DOCS=1`

Qué hace cada deploy:

- `preDeployCommand` corre migraciones
- `initialDeployHook` corre `npm run demo:init`
- `demo:init` ejecuta `bootstrap` y luego `seed`

Eso deja una demo con data cargada desde el mockup y usuarios de prueba.

Si ya desplegaste y quieres volver a sembrar datos:

- En Render, abre un shell o lanza un one-off job con `npm run demo:init`
- Si quieres limpiar y resembrar, cambia `DEMO_RESEED=1` solo para esa ejecución

## 3. Frontend en Vercel

Crea un proyecto nuevo apuntando al mismo repo, pero con:

- Root Directory: `Frontend`

Variables en Vercel:

- `BACKEND_URL=https://TU-BACKEND.onrender.com`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`

No pongas `SUPABASE_SERVICE_ROLE_KEY` en Vercel.

El frontend ya reescribe `/api/*` hacia `BACKEND_URL`, así que el navegador sigue trabajando sobre un solo origen.

## Mantener activo el plan gratuito de Render

Los servicios gratuitos de Render entran en reposo tras 15 minutos sin trafico. El repositorio incluye un ping externo cada 10 minutos mediante GitHub Actions, que consulta el endpoint publico `/api/salud`.

En GitHub, abre `Settings` > `Secrets and variables` > `Actions` y crea el secret:

- `RENDER_BACKEND_URL=https://TU-BACKEND.onrender.com`

El workflow esta en `.github/workflows/mantener-render-activo.yml`. Tambien puedes ejecutarlo manualmente desde la pestana `Actions` para comprobarlo. Si GitHub Actions no es una opcion, configura cualquier monitor externo para hacer `GET` a `https://TU-BACKEND.onrender.com/api/salud` cada 10 minutos.

Ten en cuenta que mantenerlo activo todo el mes consume las horas gratuitas del workspace. Para una demo corta funciona bien; para disponibilidad continua, conviene usar un plan de pago.

## 4. Flujo recomendado para la demo

1. Despliega primero `Render`
2. Espera que `/api/salud` responda `ok: true`
3. Verifica que la inicialización creó el hostal y sembró datos
4. Despliega `Vercel`
5. Configura `BACKEND_URL` con la URL pública final de Render
6. Redeploy del frontend

## 5. Credenciales demo

El seed crea usuarios base a partir del mockup. Además, `bootstrap` crea el admin con las variables:

- DNI: `DEMO_ADMIN_DNI`
- PIN: `DEMO_ADMIN_PIN`

Conviene mandar la demo con esas credenciales y luego rotarlas si pasa a un ambiente más serio.

## 6. Verificaciones rápidas

Backend:

```bash
curl https://TU-BACKEND.onrender.com/api/salud
```

Frontend:

- abre login
- entra con el admin demo
- revisa habitaciones, caja, inventario y huéspedes

## 7. Notas importantes

- `Render` corre el backend como servicio persistente; `Vercel` solo sirve el frontend
- la data demo vive en `Supabase`, no en Render ni en Vercel
- si cambias el `slug` del hostal, cambia también el set de credenciales que vas a compartir
