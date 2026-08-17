# Plan de trabajo — Nuevos cambios Atlas (turno/caja · agente · login · admin)

> Estado: **✅ implementado (M1–M5)** · Fecha: 2026-08-06 · Todo UI/mock, listo para validar y pasar a la fase backend.
> Alcance de esta iteración: **solo interfaz (front-only, mock). Sin backend.**
> Fuente de verdad del producto: [context.md](context.md) · Roadmap general: [plan.md](plan.md)
> Entregable que se toca: [hostal-atlas.html](hostal-atlas.html) (+ [design-tokens.css](design-tokens.css)).

---

## Problema y usuario

El personal de un hostal pequeño (recepción, limpieza, administrador) necesita **cerrar cada turno con control real**: contar insumos, justificar lo que falta, y cuadrar la caja (incluyendo pagos en dólares) sin planillas paralelas. Hoy el prototipo no tiene turnos, ni caja, ni login, ni pantallas de administración, y el asistente entiende frases pero no se siente como un **agente** con el que se conversa. Estos cambios cierran esos huecos **a nivel de interfaz**, para validar el flujo con el cliente antes de construir el backend.

## Objetivo

Agregar al prototipo Atlas, **como UI navegable y simulada**, cinco capacidades: (1) login con rol, (2) pantallas de administración, (3) inventario con conteo por turno e incidencias, (4) cierre de caja asistido por IA con tipo de cambio y resumen por correo, y (5) un agente conversacional con reconocimiento de entidades y voz.

**No funcionales que importan:** coherencia total con el design system Atlas (dark-first, un solo acento primario violeta, IA etiquetada, lo sensible lo confirma un humano); lenguaje amigable para personal no técnico; **funciona sin internet** (todo mock); nada rompe las vistas actuales; el estado sigue viviendo en JS (se pierde al recargar, es aceptable en esta fase).

---

## Decisiones de diseño (justificadas)

1. **Un solo flujo "Cierre de turno"** en vez de caja e inventario sueltos. El conteo de cierre, las incidencias y la caja ocurren en el mismo momento operativo (fin de turno); unificarlos evita doble trabajo y refleja lo que describió el cliente ("el botón de cierre vive en Inventario y encadena todo").
2. **Todo simulado, con la costura marcada.** Tipo de cambio = campo editable con valor "sugerido"; correo = vista previa del resumen (no se envía); WhatsApp = pantalla de código mock; voz = dictado del navegador si existe, si no, transcripción simulada. Cada punto queda comentado en el código como `// [BACKEND]` para la fase real.
3. **El agente es una evolución de `parse()`, no un reemplazo.** Ya detecta el número de cuarto; se extiende a reconocer **entidades** (cuarto / producto / huésped) y a responder con un **menú de acciones contextual** en lugar de solo una tarjeta. Se conserva el principio "IA propone → humano confirma lo sensible".
4. **Login con rol define visibilidad, no seguridad.** Es un gate mock; el rol (recepción / limpieza / administrador) controla qué ve cada quien (las pantallas admin son solo de administrador). La seguridad real es de la fase backend.
5. **Reutilizar los componentes existentes** (`card`, `badge`, `stChip`, `toast`, drawers, command palette) para que lo nuevo se vea nativo y no "pegado".
6. **Caja en Soles como moneda base.** Aunque se acepten pagos en otras monedas, todo se consolida y se cierra en **S/** (convertido con el tipo de cambio). Una sola moneda de registro evita descuadres y ambigüedad en el resumen del turno.

---

## Arquitectura propuesta (C4 adaptado a front-only)

**Contexto.** Tres tipos de usuario (recepción / limpieza / administrador) operan una SPA de un solo archivo. Los "sistemas externos" —correo, WhatsApp, API de tipo de cambio, motor NLP/voz— están **simulados** en esta fase; se documentan como límites hacia el backend futuro.

**Contenedor.** Un HTML autónomo (Tailwind CDN + Lucide + Inter + JS vanilla). Sin build. Estado en memoria JS. Router de vistas por `go('vista')` sobre `<section class="view">`.

**Componentes (nuevos, dentro del mismo archivo).**

```
AuthGate        → pantalla login (DNI+PIN) + recuperación WhatsApp (mock); crea SESSION
RoleGuard       → filtra el nav y bloquea vistas según SESSION.role
AdminCRUD       → vistas de productos / personas / cuartos (alta/edición manual o por IA)
TurnoManager    → apertura y cierre de turno; conteo esperado vs contado; arrastre entre turnos
IncidenciaFlow  → convierte descuadres en incidencias con justificación obligatoria
CajaClose       → total del turno, multimoneda con tipo de cambio, IA "¿conforme?", resumen/correo (preview)
AgentEntities   → extiende parse(): reconoce cuarto/producto/huésped → menú de acciones contextual
VoiceInput      → botón de micrófono (Web Speech si está disponible; si no, dictado simulado)
```

Estos componentes **no reemplazan** los actuales; se enganchan al router y al motor de IA existentes.

## Modelo de datos (estado JS)

Se extienden estructuras existentes y se agregan nuevas (todo en memoria):

| Estructura | Cambio |
|---|---|
| `ROOMS` | + `aforo` (n° máx. de personas) · + `features` (array: `tv`, `calle`, `jacuzzi`, `agua_caliente`, …). Alimenta la sugerencia del agente al asignar cuarto. |
| `INV` → `PRODUCTS` | Pasa a ser administrable: + `categoria` (insumo / vendible), + `precio` (si es vendible, para la caja), se mantiene `qty/max/unit/est`. |
| **`STAFF`** (nuevo) | Personal/usuarios del sistema: `{dni, nombre, rol, telefono, activo}`. Es lo que administra "personas" y la fuente del login. |
| **`SESSION`** (nuevo) | `{dni, nombre, rol}` de la sesión activa (o `null`). |
| **`TURNO`** (nuevo) | `{id, usuario, abierto, conteoApertura:{prodId:qty}, conteoCierre:{prodId:qty}}`. |
| **`INCIDENCIAS`** (nuevo) | `{turnoId, prodId, esperado, contado, faltan, justificacion, usuario, fecha, estado}`. |
| **`CAJA`** (nuevo) | Moneda base **S/**. `{turnoId, ventas:[{concepto, monto, moneda, montoSoles}], totalEsperadoSoles, ajustes:[{montoSoles, razon}], conforme, tcs:{USD:rate,…}}`. Los pagos en otra moneda se guardan con su `montoSoles` ya convertido. |
| **`FX`** (nuevo) | Tipos de cambio editables **para convertir a S/**: `{USD:3.75, EUR:4.10, …}` con etiqueta "sugerido · editable". |

## Diagrama de secuencia — Cierre de turno (flujo clave)

```mermaid
sequenceDiagram
    participant U as Usuario (recepción)
    participant App as Atlas (UI)
    participant IA as Agente IA (mock)
    U->>App: Abrir turno → conteo de apertura
    Note over App: (más tarde, fin de turno)
    U->>App: "Cerrar turno" (botón en Inventario)
    App->>U: Conteo de cierre (esperado vs contado por producto)
    alt Hay descuadre
        App->>U: Marca faltantes; pide justificación (obligatoria)
        U->>App: Justifica cada faltante → se crean INCIDENCIAS
    end
    App->>U: Caja del turno — total vendido en S/ (otras monedas → S/ con TC)
    App->>IA: ¿Usuario conforme?
    alt Conforme
        U->>IA: Aceptar
    else No conforme
        IA->>U: ¿Por qué no? (motivo + "2 menos / X menos")
        U->>IA: Justificación → ajuste registrado
    end
    IA->>App: Genera resumen del turno
    App->>U: Vista previa de correo (mock) → "Enviado" (simulado)
```

---

## Criterios de aceptación (Definition of Done) por módulo

**M1 · Login + roles + recuperación** — ✅ hecho (2026-08-06)
- [x] Pantalla de login a pantalla completa (fuera del chrome de la app), estilo Atlas, con **DNI** (8 díg.) y **PIN de 4 dígitos** (teclado numérico, campo enmascarado).
- [x] Con credenciales mock válidas entra y crea `SESSION`; el saludo y el rol se reflejan en la topbar.
- [x] Según el rol, el nav muestra/oculta secciones (admin solo para administrador; limpieza ve una vista reducida).
- [x] "Olvidé mi PIN" abre flujo de recuperación por **WhatsApp** (mock): ingresa DNI → "código enviado" → ingresa código de 4 díg. → define nuevo PIN. Todo simulado.
- [x] "Cerrar sesión" vuelve al login.

> Implementación: `STAFF` (3 usuarios de prueba), `SESSION`, `ROLE_NAV`/`ROLE_HOME`, overlay `#authScreen`, visibilidad por `data-nav`/`data-navgroup`. Costuras marcadas con `// [BACKEND]`. Ciudad unificada a Lima.

**M2 · Pantallas admin (solo administrador)** — ✅ hecho (2026-08-06)
- [x] **Productos:** lista + alta/edición/baja (nombre, unidad, categoría insumo/vendible, precio si vendible, stock máx.).
- [x] **Personas:** lista de personal + alta/edición (DNI, nombre, rol, teléfono, activo). Alimenta el login.
- [x] **Cuartos:** lista + alta/edición con **aforo obligatorio** y **características** (chips: TV, vista a la calle, jacuzzi, agua caliente, …).
- [x] Cada uno permite **registro manual (formulario)** o **con IA** ("describe el cuarto y lo cargo": el agente parsea y precarga el formulario para que un humano confirme).

> Implementación: grupo de nav "Administración" (solo admin), vistas `view-admin-*`, `FEATURES`/`ROOM_TIPOS`/`ROLES`, CRUD sobre `INV`/`STAFF`/`ROOMS` reutilizando el drawer (`openDrawer`/`dHead`). Alta sincroniza con Habitaciones/Inventario/login. `aiParse()` precarga formularios desde lenguaje natural. Se agregaron 2 productos vendibles (Agua, Gaseosa) para el futuro cierre de caja.

**M3 · Inventario con conteo por turno** — ✅ hecho (2026-08-06)
- [x] Botón **"Abrir turno"** captura el conteo de apertura por producto.
- [x] Al **cerrar**, se pide el conteo de cierre; la UI muestra **esperado vs contado** y resalta descuadres.
- [x] Lo que queda de un turno es el punto de partida del siguiente (arrastre visible).
- [x] Un descuadre **no se puede cerrar sin justificación**: cada faltante exige un motivo → se registra como **incidencia** (visible en Alertas/Incidentes, con lenguaje seguro, sin acusar a nadie).

> Implementación: `TURNO`/`INCIDENCIAS`, barra de turno en Inventario (`#turnoBar`), drawer de conteo de cierre (esperado vs contado, justificación condicional), arrastre vía `INV.qty = contado`, lista de incidencias en Alertas (`#incidenciasList`). Esperado = apertura (sin descontar ventas/entregas todavía → `// [BACKEND]`).

**M4 · Cierre de caja asistido** — ✅ hecho (2026-08-06)
- [x] El botón **"Cierre de caja"** (dentro del cierre de turno, en Inventario) muestra el **total vendido del turno en Soles (S/)** (aunque no se haya "gastado" inventario).
- [x] **La caja se maneja y se cierra siempre en Soles (S/).** Si un pago entró en **otra moneda** (USD u otra), se ingresa monto + moneda y se **convierte a S/** con el **tipo de cambio editable** (valor sugerido); en la caja queda registrado únicamente el equivalente en S/.
- [x] La IA pregunta **"¿estás conforme?"**: **Aceptar**, o **No conforme** → la IA pide el porqué y capturás "2 menos / X menos + razón" como **ajuste justificado**.
- [x] Al cerrar, genera un **resumen del turno** (ventas, caja, incidencias) y muestra una **vista previa de correo**; "Enviar" simula el envío (toast/confirmación), sin salir a internet.

> Implementación: se encadena tras el conteo (conteo → caja → resumen), **transaccional** (incidencias + arrastre se aplican recién al enviar; cancelar no deja el turno a medias). `FX` editable (USD/EUR "sugerido"), `cajaSoles()` convierte a S/, `recalcCaja()` en vivo, estados `conforme`/`resumen`, vista previa de correo mock.

**M5 · Agente conversacional** — ✅ hecho (2026-08-06)
- [x] Escribir **"101"** (o un número de cuarto) → el agente **reconoce que es un cuarto** y responde con un **menú de acciones** (Limpiar, Renovar, Ver estado, Check-in…), no con una respuesta genérica.
- [x] Reconoce también **producto** y **huésped** como entidades y ofrece acciones acordes.
- [x] Botón de **micrófono**: usa el dictado del navegador si está disponible; si no, simula la transcripción. Deja claro que "podés hablarle".
- [x] Se mantiene el patrón: lo sensible (cobros/compras/incidentes) exige **confirmación humana explícita**, con la tarjeta etiquetada como IA.

> Implementación: `agentEntity()` detecta entidad suelta (cuarto/producto/huésped) con guarda de verbo (comandos completos siguen yendo a `parse()`); menús contextuales que reutilizan flujos existentes; `voiceInput()` con Web Speech + fallback simulado (`simulateDictado`). El chip sensible sigue pasando por `parse()`/`card()`, que mantiene "Requiere confirmación".

---

## Puntos de integración y riesgos

- **No romper lo existente:** el login envuelve la app; hay que asegurar que `go()`, el command palette, el toggle de tema y el check-in sigan funcionando dentro de la sesión.
- **Coherencia visual:** todo lo nuevo usa tokens Atlas y componentes existentes (`card`, `badge`, `toast`, drawers). Riesgo de "pantallas que parecen de otra app" si se improvisa estilo → mitigar reutilizando helpers.
- **Densidad de datos mock:** para que "no parezca IA", los conteos, incidencias y caja deben tener datos realistas (nombres, montos en S/, un par de incidencias de ejemplo).
- **Moneda/ubicación:** ya hay un pendiente en `context.md` (header "Medellín" con Soles). Aprovechar esta iteración para unificar a contexto peruano.

## Resiliencia (en clave prototipo)

- **Sin internet:** ningún flujo depende de red. Web Speech y avatares externos degradan a simulación/color.
- **Datos incompletos:** si un producto/cuarto no tiene todos los campos, la UI muestra placeholders, no se rompe.
- **Recarga:** el estado se reinicia (es memoria JS); se documenta como limitación esperada de esta fase.

## Estrategia de pruebas

Al ser un prototipo de un solo archivo sin runner de tests, la verificación es **QA manual por criterio de aceptación**: por cada slice, recorrer su checklist de arriba en el navegador (abrir con doble clic), en tema claro y oscuro, y en viewport móvil y desktop. Al cerrar cada slice, validar además que **las vistas viejas siguen intactas** (regresión visual rápida). Si más adelante se migra a un stack productivo (React/Vue, ver `plan.md`), ahí entra la pirámide de tests real.

## Plan de Git

El proyecto **no está en git** hoy. Recomendado (opcional pero conviene): `git init` y trabajar por ramas `feature/*`, una por módulo, con Conventional Commits:
- `feat(auth): login DNI+PIN con rol y recuperación WhatsApp (mock)`
- `feat(admin): CRUD de productos, personas y cuartos con aforo y features`
- `feat(inventario): conteo por turno con incidencias justificadas`
- `feat(caja): cierre de caja asistido con tipo de cambio y resumen`
- `feat(agente): entidades y menú contextual + entrada por voz`

Como es un único HTML, si preferís no usar git, alcanza con un commit lógico por módulo cuando pases a Fase 2.

---

## Pasos de implementación (vertical slices, en orden)

Ordenados por dependencia de datos y para que **cada slice sea demostrable** de punta a punta. Se recomienda implementar y validar uno antes de pasar al siguiente.

1. **M1 — Login + roles + recuperación (WhatsApp mock).** Es la puerta de entrada y habilita la visibilidad por rol que necesitan las demás. Demo: entrar como cada rol y ver el nav cambiar.
2. **M2 — Modelo de datos + pantallas admin.** Extiende `ROOMS` (aforo/features) y `PRODUCTS`, agrega `STAFF`; construye los tres CRUD (manual + por IA). Habilita datos para inventario, caja y agente. Demo: crear un cuarto con jacuzzi y aforo 3; un producto vendible.
3. **M3 — Inventario: conteo por turno + incidencias.** Abrir/cerrar turno, esperado vs contado, descuadre → incidencia con justificación. Demo: cerrar un turno con un faltante y ver la incidencia creada.
4. **M4 — Cierre de caja asistido + tipo de cambio + resumen/correo.** Encadena tras el conteo de cierre. Demo: cerrar caja con un pago en USD, marcar "no conforme", justificar, y ver la vista previa del correo.
5. **M5 — Agente conversacional (entidades + menú contextual + voz).** Evoluciona `parse()`/`askAI()`. Demo: escribir "101" y recibir el menú de acciones; usar el micrófono.

> Al terminar cada slice, se marca su checklist de criterios de aceptación. Si aparece algo no contemplado (un caso borde de diseño), se vuelve a este plan antes de improvisar.

---

## Prompt de handoff para Fase 2 (implementación)

> Leé `plan-nuevos-cambios.md` e implementá el **slice 1 (M1 · Login + roles)** en `hostal-atlas.html`. Todo es UI/mock, sin backend, respetando el design system Atlas (tokens, componentes existentes, acento violeta, IA etiquetada). No rompas las vistas actuales. Cerralo contra sus criterios de aceptación antes de seguir con el slice 2. Si algo no está contemplado, avisá antes de decidir.

---

# 🔁 Iteración 2 — nuevos pedidos (2026-08-06)

> Sigue siendo **UI/mock, sin backend**. **Decisiones tomadas:** el **sencillo lo decide quien cierra** (lo que resta va a **caja chica**); un **descuadre de apertura se permite con justificación → incidencia**; medios de pago = **Efectivo · Yape · Plin · Tarjeta (BCP / BBVA / Scotiabank / Interbank)**. Orden elegido: **yo ordeno** (A → B → C → D → E → F, por dependencias).

### Slice A · Fixes rápidos — ✅ hecho (2026-08-06)
- [x] **A1.** El botón sticky del conteo de cierre **no se transparenta** al hacer scroll (era `var(--bg-sec)` inexistente → ahora `bg-bg-sec`=`--raised`, con `hair-t` y padding).
- [x] **A2.** El **título salió de la topbar** (las vistas ya tienen su `<h2>`); el **buscador se movió a la izquierda**, `flex-1 max-w-[520px]`, con placeholder más largo. `go()` protegido ante `#crumb`/`#crumbSub` ausentes.
- [x] **A3.** En Admin→Cuartos, botón **"+"** junto a "Tipo" → input inline (`toggleNuevoTipo`/`addTipoCuarto`) agrega el tipo a `ROOM_TIPOS`+`TARIFA_DEF`.
- [x] **A4.** `confirmDialog()` reutilizable; el botón "Cerrar turno y contar" pide confirmación antes de entrar al cierre.

### Slice B · Inventario: descartables vs no descartables — ✅ hecho (2026-08-06)
- [x] Cada producto tiene una **clase**: **descartable** (acciones: comprar, entregar) o **no descartable** (acciones: comprar, entregar, **aseo**).
- [x] La UI de inventario y los menús del agente ofrecen **solo las acciones válidas** según la clase (botón/acción "Aseo" solo en no descartables).
- [x] El admin (Productos) define la clase (columna + selector en el form).

> Implementación: campo `clase` en `INV`; `enviarAseo()` + lista `ASEO` (la usará la vista Limpieza en Slice E); gating en `renderInv()` y `agentProductMenu()`; `pf_clase` en el CRUD.

### Slice C · Rediseño de Caja/Turno (núcleo) — ✅ hecho (2026-08-06)
- [x] **Apertura cuenta el dinero** (`abrirTurnoForm`): esperado = `CAJA_ESTADO.sencillo`; descuadre → justificación → incidencia. Siempre arranca con el sencillo.
- [x] **Ventas por medio de pago** (`efectivo/yape/plin/tarjeta`+`banco`): desglose y por banco.
- [x] **Cierre**: recaudado total; quien cierra ingresa el sencillo a dejar; **resto → caja chica** (validado, no supera el efectivo).
- [x] **Arrastre**: `CAJA_ESTADO.sencillo` = sencillo dejado = apertura del próximo turno; `cajaChica` acumula; `CAJA_HISTORIAL` registra el cierre.
- [x] **Desglose del monto final**: efectivo físico (sencillo + ventas efectivo), billeteras (Yape/Plin), tarjeta por banco.
- [x] **Un turno a la vez**: `TURNO.dni`; login de otro no-admin se bloquea + `ALERTAS_ADMIN`; el admin entra y puede **forzar el cierre** (`forzarCierreTurno`).

> Verificado: recaudado S/308 (Ef 94/Yape 100/Plin 4/Tarj 110), efectivo en caja S/194, dejo 120 → caja chica 74; arrastre a 120; bloqueo de limpieza + alerta admin OK.

### Slice D · Vender producto ↔ cuarto — ✅ hecho (2026-08-06)
- [x] Desde un **cuarto** (drawer y menú del agente): **"Vender producto"** → `openVentaForm({cuarto})`.
- [x] Desde un **producto** vendible (card de inventario y menú del agente): **"Vender a un cuarto"** → `openVentaForm({producto})`.
- [x] `registrarVenta()`: exige turno abierto, elige producto/cuarto/cantidad/**medio de pago** (+banco si tarjeta), suma a `TURNO.ventas`, descuenta stock y registra en `VENTAS_LOG` (dashboard).

### Slice E · Vistas nuevas en Operación — ✅ hecho (2026-08-06)
- [x] **Caja (lista)**: sencillo actual, caja chica acumulada, turnos cerrados + tabla de `CAJA_HISTORIAL` con desglose por medio.
- [x] **Dashboard**: **productos más consumidos** y **cuartos más frecuentes** (barras desde `VENTAS_LOG`) + stat cards.
- [x] **Limpieza**: cuartos por atender (estado Limpieza/Inspección/Check-out, estilo Habitaciones) + pendientes de aseo (`ASEO`).
- [x] Nav en Operación + visibilidad por rol (Caja/Dashboard: recepción+admin; Limpieza: +limpieza/mantenimiento).

### Slice F · Acompañante — ✅ hecho (2026-08-06)
- [x] En **check-in**, por cada acompañante se captura **nombre + DNI** (`ciAcomp[i] = {nombre, dni}`). (Reservas sigue en empty state; el campo aplicará cuando se construya.)

> Iteración 2 completa (A–F). Todo UI/mock, verificado por DOM y visualmente. Sin errores de consola.
