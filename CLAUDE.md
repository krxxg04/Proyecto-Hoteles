# CLAUDE.md — Reglas de la casa (Hostal Inteligente)

> Todo agente que trabaje en este repo debe seguir esto. Contexto completo: `context.md`, `plan.md`, `ADR-001-stack-arquitectura.md`.

## Producto
SaaS multi-tenant de gestión de hostales con IA como núcleo. Mercado Perú, moneda **S/**. Modelo: licencia mensual. Hoy hay un **prototipo front-only** (`hostal-atlas.html`) que es la referencia visual y de lógica.

## Stack (decidido en ADR-001)
Next.js + TypeScript (PWA) · Supabase Postgres con **RLS por `tenant_id`** · Cloudflare R2 para fotos/video · **Claude Haiku** para IA (híbrido: reglas primero, LLM en el resto) · Cloudflare hosting.

## Reglas de seguridad (GATE de merge — innegociable)
Ningún cambio se integra sin:
1. **RLS activado y testeado** en toda tabla tocada (probar aislamiento cross-tenant).
2. **`service_role` / claves nunca en el cliente**; secretos solo en servidor / `.env` (nunca commiteados).
3. **Buckets R2 privados + URLs firmadas** para fotos/video (jamás públicos).
4. Datos sensibles (rostro/DNI): consentimiento, cifrado, retención + borrado (Ley 29733).

## Convenciones
- **Idioma de UI: español neutro** (nada de voseo argentino).
- TypeScript en todo. Componentes a partir de los **tokens Atlas** (`design-tokens.css`).
- Una rama por tarea; commits pequeños y descriptivos. No romper `main`.
- No subir a remotos personales; este repo es de la empresa.

## Cómo trabajar
- Tareas grandes → dividir y delegar en subagentes: **backend**, **frontend**, **ai-media** (ver `.claude/agents/`).
- Para trabajo en paralelo que toca archivos, usar **git worktrees** (aislar por rama).
- Al terminar una fase: resumir qué se hizo, qué falta y qué quedó pendiente de validar contra el GATE de seguridad.
