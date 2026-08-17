# ADR-001 — Stack y arquitectura del MVP (Hostal Inteligente)

- **Estado:** Aceptado · **Fecha:** 2026-08-17 · **Autor:** equipo Massive Dynamics
- **Contexto de lectura:** este documento es autocontenido. Un agente (orquestador o worker) puede leerlo y ejecutar sin más contexto previo. Complementa `context.md` (qué es) y `plan.md` (roadmap).

---

## 1. Contexto

Producto: **SaaS de gestión de hostales con IA como núcleo**, para el mercado peruano. Hoy existe un **prototipo front-only** (`hostal-atlas.html`, design system "Atlas", moneda **S/**) que valida UX y features. Toca pasarlo a MVP real.

**Modelo de negocio:** licencia mensual (referencia de mercado: SysHotel S/ 140–350/mes). Distribución masiva multi-tenant.

**Prioridades (en orden):** bajo costo de mantenimiento · uso de IA barato · almacenamiento (fotos + video premium) económico · alta disponibilidad · sin lag en Perú · seguro (datos sensibles: rostros/DNI). Equilibrio económico/bueno.

---

## 2. Decisión — Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| **Frontend** | **Next.js (App Router) + TypeScript + Tailwind**, entregado como **PWA** | Un framework para front + API. Tokens "Atlas" (variables CSS) → `tailwind.config`. PWA instalable en tablet/celular de recepción y limpieza, sin tienda de apps. |
| **Backend** | **Next.js Route Handlers / Server Actions** (TS) + **Supabase Edge Functions / Cloudflare Workers** para jobs async | Secretos (claves IA, pagos, `service_role`) solo en servidor. TypeScript de punta a punta. |
| **Base de datos** | **Supabase (Postgres) + RLS por `tenant_id`** | Relacional (reservas/caja/inventario/auditoría), multi-tenant seguro, trae Auth + Storage + Realtime. Postgres puro → sin lock-in. |
| **Archivos (fotos/video)** | **Cloudflare R2**, buckets **privados** + **URLs firmadas** | Egress $0 al servir. NO usar Supabase Storage para medios (su egress cobra). |
| **IA (modelo barato)** | **Claude Haiku** por API, **server-side**, en modo **híbrido** | Reglas resuelven ~80% (gratis); el LLM solo el resto. Tool-use → JSON de la tarjeta de acción. Prompt caching. |
| **Voz / OCR** | **Web Speech API** (gratis) + OCR bajo demanda (Google Vision / Tesseract) para DNI/facturas | No hostear modelos. |
| **Auth** | **Supabase Auth** (DNI + PIN; MFA para admin) | Calza con el login por roles del prototipo. |
| **Hosting** | **Cloudflare Pages/Workers** (PoP en Lima) — alt. Vercel | Barato, escala a cero, baja latencia en Perú. |
| **Realtime** | **Supabase Realtime** | Estado de cuartos en vivo entre recepción y limpieza. |
| **Pagos (licencia)** | **Culqi / Izipay / Mercado Pago** (soles) | Cobro de suscripción mensual. |
| **Facturación SUNAT** | **Nubefact / OSE** por API | No construir; integrar. |
| **Errores/monitoreo** | **Sentry** | Observabilidad en producción. |

**En una línea:** Next.js + TS (PWA) · Supabase Postgres con RLS · Cloudflare R2 para medios · Claude Haiku (híbrido con reglas) · Cloudflare hosting.

### Alternativa (solo si el cliente exige GCP / residencia)
Cloud SQL (Postgres, región **southamerica-west1 / Santiago**) + Cloud Run + Firebase Auth. Mismo patrón; R2 para archivos, Haiku para IA. Más piezas y más base fija. Para arrancar barato, **Supabase gana**.

---

## 3. Arquitectura

### Multi-tenant
- **Una sola app + una sola DB** para todos los tenants. Aislamiento por `tenant_id` + **RLS activado en TODAS las tablas**. Nada de infra por cliente.

### Flujo de un comando del asistente (IA híbrida)
```
Usuario ("a la 203 dos toallas")
  → Front (Next.js/PWA)
    → Server Action (TS)  ── ¿regla conocida? ── sí → arma tarjeta (gratis)
                                     └ no → Claude Haiku (tool-use → JSON acción)
    → confirma humano → escribe en Postgres (RLS) + audit log
    → foto/clip → R2 (URL firmada)
```

### Capa de medios
- **Fotos (todos los planes):** DNI/rostro comprimidos ~150 KB → R2 (privado, URL firmada). ~5 GB/año/hostal → centavos. **Dato sensible** (Ley 29733): consentimiento, cifrado, retención + borrado.
- **Video (plan premium):** el único costo que escala fuerte. Arquitectura recomendada: **NVR local (edge) en el hostal** guarda continuo; a la nube suben **solo clips de eventos + miniaturas + metadatos**. R2 con **reglas de ciclo de vida** (auto-borrado a N días) + **H.265** + resolución de archivo. Servir con R2 (egress $0).
- **Precio premium por cámara/retención** para que el plan cubra su propio storage (como SysHotel cobra por habitación/OTA).

| Modo de video | Peso aprox. | Retención 30 d en R2 |
|---|---|---|
| 24/7 1080p continuo | ~48 GB/día/cámara | ~$22/mes por cámara (evitar) |
| 24/7 720p + H.265 (7 d) | ~10 GB/día | ~$1/mes por cámara |
| Solo clips de evento | ~3 GB/día | ~$1.3/mes por cámara |

---

## 4. Seguridad (checklist obligatorio) + Ley 29733 (Perú)

> La plataforma (Supabase/AWS, SOC 2, cifrado AES-256 + TLS) es segura; **el 90% del riesgo es configuración**. El error clásico que filtra datos es **olvidar RLS**.

- [ ] **RLS activado en cada tabla**, política de aislamiento por `tenant_id`. **Testear** cross-tenant (un tenant no ve a otro).
- [ ] **`service_role` key nunca en el frontend** — solo en servidor. La `anon key` es pública a propósito; la seguridad viene del RLS.
- [ ] **Buckets R2 privados + URLs firmadas temporales** para fotos/video (jamás bucket público).
- [ ] Cifrado a nivel app de campos sensibles (nº documento) — capa extra opcional.
- [ ] **MFA** para admins; rotación de claves; menor privilegio.
- [ ] **Retención + borrado** de fotos de DNI y video (mínimo legal/operativo); derecho a eliminación.
- [ ] **Consentimiento** (ya en UX); **sin cámaras en zonas privadas** (ya en UX); reconocimiento facial opcional con revisión humana.
- [ ] **Audit log** de acciones e inventario (ya en el prototipo).
- [ ] Documentar **región de datos** (AWS `sa-east-1` São Paulo con Supabase) y **proceso de notificación de brechas**.

---

## 5. Costos (infra, no por hostal)

| Escala | Supabase (DB+compute) | R2 (fotos + video c/retención) | Cloudflare + IA + Sentry | Total infra |
|---|---|---|---|---|
| 10 hostales | $25 | ~$1 | ~$5 | **~$31/mes** |
| 50 hostales | $25–40 | ~$5 | ~$8 | **~$40–55/mes** |
| 200 hostales | $85–170 | ~$15 | ~$15 | **~$115–200/mes** |

Con licencias S/ 89–150 c/u, el margen es amplio. El costo que escala es el **video premium** → cubierto por precio por cámara/retención. **Storage estructurado no es el problema**; el problema sería el **egress** (resuelto con R2) y el **compute** (instancia mayor al crecer). Migrar la DB es trivial (Postgres puro).

---

## 6. Migración desde el prototipo (`hostal-atlas.html`)

El prototipo **no se descarta** — es la fuente visual y de lógica de referencia.
1. Portar **tokens Atlas** → `tailwind.config` (paleta dark/light, tipografía Inter, elevación).
2. Cada `view-*` → página/componente Next.
3. `ROOMS / INV / GUESTS / STAFF / TURNO / INCIDENCIAS` (hoy en memoria) → tablas Postgres con RLS.
4. `parse()` / `agentEntity()` → Server Action: primero reglas, luego Haiku.
5. Fotos/video → subida a R2 con URL firmada.
6. Auth por DNI+PIN y roles (`ROLE_NAV`) → Supabase Auth + policies.
7. Tarifas del check-in → leer `tarifaOf()`/tarifario configurado por Admin (no constantes; ver `[BACKEND]` en `stayInfo()`).

---

## 7. Reparto sugerido para la flota de agentes

> El orquestador puede asignar así (ajustar a gusto). Cada worker trabaja en su rama.

- **worker-1 — Backend / Datos:** esquema Postgres + **RLS por tenant** + migraciones; Supabase Auth (DNI/PIN/roles); Server Actions CRUD (cuartos, reservas, inventario, caja, huéspedes, auditoría); integración R2 (subida + URLs firmadas). Entregable: API tipada + policies testeadas cross-tenant.
- **worker-2 — Frontend:** scaffold Next.js + Tailwind con tokens Atlas; portar vistas del prototipo a componentes; PWA; consumo de las Server Actions; Realtime de estado de cuartos. Entregable: app navegable conectada a datos reales.
- **worker-3 (o worker-1) — IA + Medios:** motor híbrido (reglas + Claude Haiku server-side, tool-use → JSON de tarjeta); OCR DNI/factura; pipeline de fotos (compresión) y video premium (clips/eventos + ciclo de vida en R2).
- **Transversal (orquestador):** billing (Culqi/Izipay) + SUNAT (Nubefact), Sentry, checklist de seguridad §4 como *gate* de merge.

**Regla de oro para todos los agentes:** ningún merge pasa sin (a) RLS activado y testeado en las tablas tocadas, (b) `service_role`/claves fuera del cliente, (c) buckets privados con URL firmada.

---

## 8. Decisiones abiertas
- Región DB definitiva (Supabase São Paulo vs GCP Santiago) según latencia medida real en Lima.
- ¿PWA suficiente o se requiere app nativa (React Native/Expo) en fase 2?
- Estructura final de planes (Base / Premium con video) y su componente por cámara.
- Proveedor de OCR y de STT de servidor (si Web Speech no alcanza).

---

*Fin del ADR-001. Cambios de stack se registran en un ADR nuevo, no editando este.*
