# Backend — Hostal Inteligente (plan base)

Next.js 16 + TypeScript. Server Actions para el frontend, rutas `/api` para poder
probar con curl o Postman antes de que exista una sola pantalla.

Stack según [ADR-001](../ADR-001-stack-arquitectura.md) §2. La base de datos está
en [../Database/](../Database/).

## Puesta en marcha

**1. Aplicar el SQL** en el SQL Editor de Supabase, en orden:

```
Database/01_schema.sql              tablas + RLS
Database/02_auth_y_auditoria.sql    login DNI+PIN + auditoría
Database/03_logica_negocio.sql      tarifas, ventas, turno, caja
```

**2. Bajar el mínimo de contraseña** si vas a usar PIN de 4 dígitos:
Authentication → Providers → Email → *Minimum password length* = 4.
Si prefieres no tocarlo, usa PIN de 6 dígitos.

**3. Crear el hostal y el primer administrador:**

```bash
node --env-file=.env.local scripts/bootstrap.mjs \
  --hostal "Hostal Aurora" --slug aurora --ciudad Lima \
  --dni 40123456 --nombre "Ana Torres" --pin 123456
```

Se corre una sola vez. Después el personal se da de alta desde la aplicación.

**4. Asistente con IA (opcional):** añade `ANTHROPIC_API_KEY=...` a `.env.local`. Sin clave el
asistente funciona igual, solo con reglas; lo que no reconozca responde "no entendí".

**5. Levantar:**

```bash
npm run dev      # desarrollo
npm run build    # verificar que compila
npm start        # producción local
```

## Probarlo desde el navegador (Swagger)

**<http://localhost:3000/docs>** — entra con `POST /api/auth`, abre turno con `POST /api/turno` y el resto ya sale autenticado.

La especificación está en `/api/openapi` (importable en Postman). Ambas rutas dan 404 en producción; se reabren con `HABILITAR_DOCS=1`. Al tocar una ruta de `src/app/api/`, actualizar `src/lib/openapi.ts`.

## Probarlo con curl

```bash
# Ping (público)
curl http://localhost:3000/api/salud

# Entrar — guarda la cookie de sesión
curl -c cookies.txt -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"dni":"40123456","pin":"123456"}'

# A partir de aquí, mandar siempre la cookie
curl -b cookies.txt http://localhost:3000/api/panel
curl -b cookies.txt http://localhost:3000/api/cuartos
curl -b cookies.txt "http://localhost:3000/api/cuartos?conteo=1"

# Abrir turno (sin esto no se puede vender ni hacer check-in)
curl -b cookies.txt -X POST http://localhost:3000/api/turno \
  -H "Content-Type: application/json" -d '{"efectivo_contado":0}'

# Vender — fíjate que NO se manda el monto
curl -b cookies.txt -X POST http://localhost:3000/api/ventas \
  -H "Content-Type: application/json" \
  -d '{"producto_id":"<uuid>","cantidad":2,"medio":"efectivo"}'

# Check-in
curl -b cookies.txt -X POST http://localhost:3000/api/checkin \
  -H "Content-Type: application/json" \
  -d '{"cuarto_id":"<uuid>","modo":"rango","noches":2,"personas":2,
       "nombre":"Julia Paredes","num_doc":"76543210","medio":"efectivo"}'

# Cerrar turno
curl -b cookies.txt "http://localhost:3000/api/turno?conteo=1"   # qué debería haber
curl -b cookies.txt -X PUT http://localhost:3000/api/turno \
  -H "Content-Type: application/json" \
  -d '{"conteos":[{"producto_id":"<uuid>","contado":38}],"sencillo_dejar":0}'
```

## Cómo está organizado

Módulos por contexto, cada uno en tres capas. El ADR-001 no fija arquitectura interna: esto es
decisión propia (ver [ADR-002](../ADR-002-arquitectura-backend.md)).

```
src/
  shared/                  lo transversal
    dominio/               rol, medio de pago, tipo de documento
    resultado.ts           { ok, datos } | { ok, error } + errores en español
    sesion.ts              quién está conectado y con qué rol
    http.ts                puente entre casos de uso y HTTP
    supabase/              clientes: servidor (RLS) y admin (service_role)
    docs/                  spec OpenAPI + interruptor de Swagger
  modules/<contexto>/
    domain/                tipos, enums, esquemas zod y reglas puras
    application/           casos de uso ('use server') — esto consume el frontend
    infrastructure/        acceso a Supabase y llamadas RPC
  app/api/                 rutas HTTP para probar sin interfaz
  app/docs/                Swagger UI (solo fuera de producción)
  proxy.ts                 refresco de sesión (en Next 16 se llama proxy)
```

Los contextos: `auth` · `personal` · `cuartos` (habitaciones + tarifario) · `estadias` (check-in,
check-out, inspecciones) · `inventario` (catálogo, stock, aseo) · `ventas` · `caja` (turnos e
incidencias) · `huespedes` · `reportes` · `asistente` (IA híbrida).

## Dos decisiones que conviene entender

**El precio nunca viaja desde el cliente.** Al vender solo se manda el producto y
la cantidad; el monto sale del catálogo dentro de la base. El prototipo lo
calculaba en el navegador, así que con la consola abierta se podía vender a
cualquier precio.

**El aislamiento entre hostales no depende de acordarse de filtrar.** Ninguna
consulta filtra por `tenant_id` — lo impone el RLS de Postgres. Si mañana alguien
escribe una consulta y se olvida, sigue sin poder ver datos ajenos.

## Fuera de alcance por ahora

Cloudflare R2, Claude Haiku, RFID, cámaras y facturación SUNAT son de la línea
premium o de fases posteriores. Este backend solo necesita Supabase.
