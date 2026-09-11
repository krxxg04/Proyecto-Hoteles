# Hostal Inteligente (Atlas)

SaaS multi-tenant de gestión de hostales con IA como núcleo. Mercado Perú, moneda **S/**.

Este README es solo la puerta de entrada. Para trabajar en el proyecto, lee en orden:

1. **[`CLAUDE.md`](CLAUDE.md)** — las reglas de la casa y el gate de seguridad que no se negocia.
2. **[`ADR-001-stack-arquitectura.md`](ADR-001-stack-arquitectura.md)** — el stack y qué es premium.
3. **[`ADR-002-arquitectura-backend.md`](ADR-002-arquitectura-backend.md)** — cómo está organizado el backend.
4. **[`ESTADO.md`](ESTADO.md)** — documento de traspaso: qué hay hecho, qué falta y por qué. Léelo antes de tocar código.

Contexto de producto en [`context.md`](context.md) y el plan original en [`plan.md`](plan.md). `ADR-003`/`ADR-004` cubren la decisión del proveedor de IA, y `DEPLOY_DEMO.md` el despliegue de la demo pública.

```
Hotel/
  Backend/     API + lógica de negocio     · puerto 3000
  Frontend/    interfaz (PWA)              · puerto 3001
  Database/    migraciones SQL versionadas
  index.html   prototipo, referencia visual y de lógica (no se toca)
```
