# ADR-002 — Arquitectura interna del backend

- **Estado:** Aceptado · **Fecha:** 2026-08-26
- **Alcance:** organización del código de `Backend/`. No cambia el stack de [ADR-001](ADR-001-stack-arquitectura.md).

## Contexto

ADR-001 fija el stack y las reglas multi-tenant, pero no dice cómo organizar el backend por dentro. La primera versión puso todo en `src/actions/*.ts`, con validación, orquestación y acceso a datos en el mismo archivo (`productos.ts` llegó a 285 líneas).

## Decisión

**Módulos por contexto, tres capas cada uno.**

```
src/shared/              dominio transversal, sesión, resultado, HTTP, clientes Supabase, docs
src/modules/<contexto>/
  domain/                tipos, enums, esquemas zod y reglas puras
  application/           casos de uso ('use server') — lo que consume el frontend
  infrastructure/        acceso a Supabase y llamadas RPC
```

Contextos: `auth` · `personal` · `cuartos` · `estadias` · `inventario` · `ventas` · `caja` · `huespedes` · `reportes`.

## Dónde vive cada invariante

**La base de datos es el modelo de dominio.** Las reglas que no pueden saltarse viven en Postgres, no en TypeScript:

- Aislamiento entre hostales → RLS. Ninguna consulta filtra por `tenant_id`.
- Precio de venta y de estadía → `registrar_venta`, `calcular_tarifa`. El monto nunca viaja desde el cliente.
- Atomicidad de check-in y cierre de turno → `registrar_checkin`, `cerrar_turno`. El INSERT directo sobre `ventas` y `movimientos_inventario` está revocado.

La capa `domain/` de TypeScript queda deliberadamente delgada: forma de los datos, enums y cálculos puros de presentación (cobertura de stock). **No se replican en TS las reglas que Postgres ya impone** — dos fuentes de verdad se desincronizan, y la de TS es la que se puede esquivar.

## Consecuencias

- `application/` es testeable sin base sustituyendo `infrastructure/`.
- Los repositorios devuelven el resultado crudo de Supabase; `traducirError` se aplica en `application/`.
- No hay repositorios genéricos ni mappers entidad↔fila: con el esquema mandando, sería ceremonia.
- Un caso de uso nuevo toca tres archivos en vez de uno. Es el precio de que cada uno sea corto.

## Alternativas descartadas

- **Seguir con `actions/` plano:** más simple, pero los archivos ya no cabían en la cabeza.
- **DDD completo con entidades ricas y agregados:** obligaría a mover las invariantes de Postgres a TS, perdiendo transaccionalidad y RLS como red.
