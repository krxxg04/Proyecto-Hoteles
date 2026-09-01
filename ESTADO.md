# Estado del proyecto — Hostal Inteligente

> Documento de traspaso. Última actualización: 2026-08-28.
> Contexto de producto: `context.md` · Stack: `ADR-001` · Arquitectura backend: `ADR-002` · Reglas: `CLAUDE.md`

---

## Para retomarlo en frío

Lee, en este orden: **`CLAUDE.md`** (las reglas y los cuatro gates), **`ADR-001`** (stack y
qué es premium), **`ADR-002`** (cómo está organizado el backend) y este documento. El
mockup `index.html` es la referencia visual y de lógica — **no se toca**, se porta.

Y esto de aquí, que es lo que no está escrito en ningún otro sitio:

- **La base de datos es el modelo de dominio.** El aislamiento, los precios y la
  atomicidad viven en Postgres. Si una regla se puede saltar desde TypeScript, no es una
  regla: está en el sitio equivocado.
- **El gate #1 es ejecutable.** `npm run prueba:aislamiento` sale con código 1 si falla.
  Antes de dar por buena cualquier afirmación sobre seguridad, córrelo.
- **Lo que no existe se dice.** El mockup rellenaba huecos con datos bonitos («Última
  limpieza: Hoy · 09:40» fijo para cualquier habitación). Aquí no: si no hay reservas,
  pone «Sin reservas». Un dato inventado en la pantalla de recepción es peor que un hueco.
- **Hay dos cosas escritas y nunca ejecutadas**, y están marcadas como tales: el camino de
  Claude Haiku (falta la clave) y el de fotos en R2 (falta la cuenta). `GET /api/salud` lo
  dice. No las des por funcionando.

### Los comandos

```bash
cd Backend && npm run dev              # :3000 · API + Swagger en /docs
cd Frontend && npm run dev             # :3001 · la app, aquí entras
```

Y en `Backend/package.json`, todos con `--env-file=.env.local` ya puesto:

| Comando | Qué hace |
|---|---|
| `npm run migrar` | Aplica lo pendiente de `Database/` |
| `npm run migrar:estado` | Solo informa: qué hay aplicado, qué falta, qué se alteró |
| `npm run prueba:aislamiento` | **El gate.** 83 comprobaciones; sale con código 1 si falla |
| `npm run seed -- --slug aurora` | Los datos del prototipo (`--limpiar` borra y recarga) |
| `npm run bootstrap -- ...` | Alta de un hostal nuevo con su primer administrador |
| `npm run purgar:medios` | Borra las fotos vencidas (`--simular` para ver qué se iría) |

Y antes de dar algo por terminado, en las dos apps: `npx tsc --noEmit` y `npx eslint src/`.

En PowerShell no existe `&&`: usa `;` o dos terminales.

---

## 0. De dónde viene esto

El punto de partida fue una auditoría contra los tres documentos de `.claude/agents/`
(`backend.md`, `frontend.md`, `ai-media.md`). Coincidía en gran parte porque los tres
derivan del ADR-001, pero había huecos, y **uno era el gate de merge**: `CLAUDE.md` exige
«RLS activado y testeado» y el aislamiento entre hostales nunca se había probado — solo
había un hostal en la base, así que cualquier consulta devolvía lo correcto por
casualidad.

Desde ahí se cerró, en este orden: el gate (§4), las migraciones versionadas (§2), el
origen en auditoría (§5), los datos del prototipo (§2), las vistas que faltaban (§7), los
tres roles (§6), R2 (§9), y por último la validación en navegador (§8), que sacó cinco
fallos más.

Lo que queda sin hacer está en §11, cada cosa con su razón.

---

## 1. Qué hay hoy

Dos aplicaciones Next.js 16 independientes, funcionando contra una base Supabase real con los datos del prototipo.

```
Hotel/
  Backend/     API + lógica de negocio     · puerto 3000
  Frontend/    interfaz (PWA)              · puerto 3001
  Database/    los 9 SQL, versionados
  index.html   prototipo, referencia visual y de lógica (no se toca)
```

**El front consume el backend por HTTP**, no por Server Actions: son dos apps y las Server Actions no cruzan entre ellas. `Frontend/next.config.ts` reescribe `/api/*` al backend, así el navegador habla con un solo origen — sin CORS ni cookies entre dominios.

La única excepción es **Supabase Realtime**, que sí va directo desde el navegador con la clave pública. Ver §7.

### Dónde está cada cosa

`ADR-002` manda: módulos por contexto, tres capas cada uno (`domain/` · `application/` ·
`infrastructure/`), más `ui/` en el frontend.

```
Backend/src/
  modules/     asistente · auth · caja · cuartos · estadias · huespedes
               inventario · medios · personal · reportes · reservas · ventas
  shared/      sesion · resultado · http · origen · supabase/ · dominio/ · docs/
  app/api/     20 rutas — la puerta, no la lógica
  app/docs/    Swagger
Backend/scripts/
  bootstrap.mjs        alta de hostal + primer administrador
  seed.mjs             los datos del prototipo
  migrar.mjs           el runner de Database/
  prueba-aislamiento.mjs   el gate: 74 comprobaciones
  purgar-medios.mjs    borra las fotos vencidas (Ley 29733)

Frontend/src/
  modules/     asistente · auth · caja · cuartos · estadias · huespedes
               inventario · medios · personal · reportes · reservas
  shared/      api/ (contrato HTTP) · ui/ (Chasis, Paleta, primitivos, guardia,
               navegacion, useEnVivo) · supabase/navegador.ts (solo Realtime)
  app/(sesion)/ las rutas que exigen sesión; los paréntesis lo hacen route group
  app/login/   fuera del grupo: no puede exigir sesión quien va a iniciarla
Frontend/scripts/
  iconos.mjs   genera los PNG del manifiesto desde icono.svg (usa sharp, que ya trae Next)
```

### Dependencias que se añadieron, y por qué

| Paquete | Dónde | Para qué |
|---|---|---|
| `pg` | Backend, dev | El runner de migraciones. Supabase-js no ejecuta SQL suelto; hace falta conexión directa (`DATABASE_URL`) |
| `@aws-sdk/client-s3` + `s3-request-presigner` | Backend | R2 es S3-compatible. Firmar URLs de subida y lectura |
| `@supabase/supabase-js` + `@supabase/ssr` | **Frontend** | Solo Realtime. Todo lo demás sigue yendo por HTTP al backend |

### Levantarlo

```bash
cd Backend  && npm run dev     # :3000  · API + Swagger en /docs
cd Frontend && npm run dev     # :3001  · la app
```

Entrar en <http://localhost:3001>. Usuarios cargados (§2):

| DNI | PIN | Quién | Rol |
|---|---|---|---|
| `40123456` | `123456` | Ana Torres | administrador |
| `41567890` | `112200` | Luis Quispe | recepción |
| `42876543` | `258000` | Marta Ríos | limpieza |

---

## 2. Base de datos

Proyecto Supabase `hostal-atlas-dev`. **27 tablas · RLS activo en las 27 · aislamiento probado (§4).**

### Migraciones versionadas

Ya no se pegan a mano en el editor de Supabase:

```bash
cd Backend
npm run migrar:estado     # qué hay aplicado y qué falta
npm run migrar            # aplica lo pendiente
```

`scripts/migrar.mjs` lleva la cuenta en la tabla `_migraciones`, con sha256 por archivo. Si alguien edita una migración ya aplicada, el runner **se planta**: editar una vieja es lo que rompe las bases de los demás. Cada archivo corre dentro de su propia transacción.

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `01_schema.sql` | Tipos, 27 tablas, RLS por `tenant_id` |
| 2 | `02_auth_y_auditoria.sql` | Login DNI+PIN, triggers de perfil y JWT, audit log |
| 3 | `03_logica_negocio.sql` | Tarifas, ventas, check-in, turno, caja |
| 4 | `04_permisos_service_role.sql` | Permisos para los scripts de servidor |
| 5 | `05_origen_y_realtime.sql` | `audit_log.origen` + publicación de Realtime |
| 6 | `06_ejecucion_de_funciones.sql` | Cierra la ejecución de funciones a `anon` |
| 7 | `07_medios_en_inspecciones.sql` | Enlaza la foto de inspección con `medios` |
| 8 | `08_acciones_por_rol.sql` | Estados de cuarto y compras, según quién los toca |
| 9 | `09_esperado_no_negativo.sql` | El conteo de cierre no puede esperar menos de cero |
| 10 | `10_stock_minimo_y_bajas.sql` | `productos.stock_min`, bajas reversibles de cuartos y tipos, catálogo solo para administración |
| 11 | `11_cuartos_solo_el_estado.sql` | Quien no es administración solo mueve el estado de un cuarto, no sus datos |

Las cuatro primeras están marcadas como *baseline*: ya estaban aplicadas a mano cuando se adoptó el runner, así que se registraron sin volver a ejecutarlas.

⚠️ **`Database/Supabase.txt` es una copia vieja de `01_schema.sql`. No ejecutar.** El runner la ignora (solo lee `NN_*.sql`).

### Datos cargados

`seed.mjs` porta lo que el prototipo tenía en memoria: `ROOMS`, `INV`, `GUESTS`, `STAFF`, `VENTAS_LOG`, `CAJA_ESTADO` y el tarifario real (`TARIFA_DEF` + `ROOM_TIPOS`).

```bash
cd Backend
node --env-file=.env.local scripts/bootstrap.mjs --hostal "Hostal Aurora" --slug aurora \
  --ciudad Lima --dni 40123456 --nombre "Ana Torres" --pin 123456
npm run seed -- --slug aurora        # --limpiar borra y recarga
```

`--limpiar` **se niega si hay un turno abierto**. El snapshot de apertura del turno va
indexado por el id del producto: si los productos se recrean, el snapshot queda huérfano
y el conteo de cierre sale descuadrado sin que nadie haya hecho nada mal. Cierra el turno
desde Caja y vuelve a correrlo.

Borra 17 tablas en orden inverso a las dependencias, **incluido el historial de turnos**.
Guardar conteos e incidencias que hablan de productos que se acaban de borrar deja un
registro que miente; además la cabecera del script ya dice que TURNO e INCIDENCIAS
arrancan vacíos, igual que en el prototipo.

Resultado: 5 tipos de cuarto con el tarifario del mockup · 9 habitaciones con sus estados y notas · 8 productos · 4 huéspedes · 3 estadías activas · 9 ventas históricas · caja con S/ 100 de sencillo.

Dos decisiones al portar, por si chocan con el prototipo:

- **El stock cuadra.** El mockup mostraba el stock ya consumido y, aparte, un histórico de ventas que no lo afectaba. Aquí la compra inicial es `stock del prototipo + lo vendido`, y cada venta descuenta. El número final es el mismo, pero el kardex cuadra y `esperado_cierre()` no miente.
- **Documentos peruanos.** `GUESTS` traía documentos colombianos ("CC 71.234.567") porque venía de otra plaza. Se guardan como DNI y pasaporte, con los mismos números.
- **Los PIN llevan `00` al final.** Los del prototipo son de 4 dígitos y Supabase exige 6.

---

## 3. Decisiones tomadas

| Decisión | Dónde queda | Por qué |
|---|---|---|
| Arquitectura por módulos y capas | `ADR-002` | `actions/` plano ya no cabía en la cabeza |
| La base de datos **es** el modelo de dominio | `ADR-002` | RLS, precios y atomicidad viven en Postgres |
| Front en app separada (`Frontend/`) | decisión del cliente | Decisión del cliente; obliga a HTTP en vez de Server Actions |
| Claude Haiku para la IA | `ADR-001 §2` | No es decisión abierta |
| El origen de cada escritura viaja en una cabecera | `05_origen_y_realtime.sql` | Alternativa: un parámetro en cada función SQL y en cada repositorio. Ver §5 |
| Realtime va directo del navegador a Supabase | `useEnVivo.ts` | Un socket no se puede reescribir por `next.config`. Ver §7 |
| Check-in e inspección son **cajones**, no páginas | `CajonCheckin`, `CajonInspeccion` | Es como los abre el mockup. Recepción está mirando otra cosa cuando llega alguien; abrir encima y cerrar deja la pantalla donde estaba |
| Una reserva **no bloquea** la habitación | `reservas/application` | En un hostal, bloquear al reservar es regalar noches a quien no aparece. Se reserva un *tipo*; el número se asigna al llegar |
| El resumen del panel **no se llama «de IA»** | `Panel.tsx` | Lo arman reglas, sin llamar a ningún modelo. Etiquetarlo como IA sería mentir en la propia pantalla |
| Solo hay minigráfica donde hay histórico | `Sparkline.tsx` | El mockup dibujaba cuatro con datos inventados. Una gráfica sin datos detrás no informa, decora |
| `--limpiar` también borra el historial de turnos | `seed.mjs` | Guardar conteos que hablan de productos recién borrados deja un registro que miente |
| Los nombres del menú son los del mockup | `navegacion.ts` | «Cuartos» y «Personas», no «Cuartos y tarifas» ni «Personal». Se pidió paridad estricta |
| El aviso de stock es un **mínimo por producto**, no un % del máximo | `10_stock_minimo_y_bajas.sql` | Un 25 % de 120 rollos y un 25 % de 60 sábanas son avisos muy distintos. Quien lleva el hostal sabe con cuánto le da tiempo a reponer |
| Cuartos y tipos **se inhabilitan, no se borran** | `10_stock_minimo_y_bajas.sql` | Hay estadías cobradas, ventas y auditoría apuntando. Y la baja tiene vuelta: `activo` existía y nadie lo devolvía a `true` |
| El **estado** de un cuarto no se edita desde `/admin/cuartos` | `VistaCuartosAdmin` | Lo mueve `cambiar_estado_cuarto()`, que audita quién fue y corta por rol. Editarlo ahí sería un `UPDATE` sin registro |
| Las fechas se formatean a mano, no con `toLocaleString` | `shared/ui/fechas.ts` | El ICU de Node y el del navegador no ponen el mismo espacio duro, y sin `timeZone` el servidor de producción formatea en UTC: cinco horas de diferencia |
| `Boton` y `Pildora` son `type="button"` por defecto | `primitivos.tsx` | Dentro de un `<form>`, un botón sin `type` es `submit`. Siete controles enviaban el formulario al hacer clic |

---

## 4. Seguridad — el gate

```bash
cd Backend && npm run prueba:aislamiento
```

**83 comprobaciones. Pasa.** Crea un segundo hostal desechable, lo llena con datos en **las 24 tablas con `tenant_id`**, entra como administrador de cada uno con la clave pública (el mismo camino que la app) e intenta cruzar la línea:

| Bloque | Qué comprueba |
|---|---|
| 0 · Cobertura | Contrasta la lista de tablas contra `01_schema.sql`. Si alguien agrega una tabla y no la agrega aquí, avisa en vez de dar un falso verde |
| 1 · Identidad | Cada sesión resuelve su propio `current_tenant_id()` |
| 2 · Lectura | Las 24 tablas, más `tenants`, `profiles` y pedir una fila ajena por id |
| 3 · Escritura | UPDATE, INSERT con `tenant_id` ajeno, DELETE, y **mudar una fila propia al otro hostal** (el `WITH CHECK`) |
| 4 · Funciones | `cambiar_estado_cuarto()` y `registrar_venta()` sobre datos del otro |
| 5 · Sin sesión | `anon` no lee ninguna tabla ni ejecuta ninguna función — salvo `resolver_login`, que es el propio login |
| 6 · Roles | Limpieza no ve caja, turnos, huéspedes ni auditoría, no toca el tarifario, **no puede ascenderse sola**, no pone un cuarto en `ocupada` ni registra compras, **no crea ni borra cuartos ni productos, no les cambia el precio ni el stock mínimo, y no inhabilita nada** — y tampoco esquivándolo con un UPDATE directo |
| 7 · Realtime | El socket también filtra por hostal, y sin sesión no entrega ninguna fila |
| 8 · Auditoría | Distingue lo que escribió el asistente de lo que escribió una persona |

**No es una prueba vacía**: el segundo hostal tiene datos en todas las tablas, así que "no veo nada del otro" significa algo.

### Lo que encontró

**El catálogo estaba abierto a cualquiera con sesión.** `aplicar_rls('productos')` y
`aplicar_rls('cuartos')` se aplicaron sin rol de escritura, así que limpieza podía crear,
editar y borrar productos y cuartos yendo directo a PostgREST: la comprobación vivía solo
en `exigirRol()` de TypeScript, y eso no es una regla. Cerrado en
`10_stock_minimo_y_bajas.sql`.

**Y `cuartos_upd` vigilaba el estado, no las columnas.** La policy de la 08 deja a limpieza
mover un cuarto que ya está en un estado de piso — pero ese mismo `UPDATE` podía traer
cualquier otra columna: `activo`, `numero`, `tipo_id` y, lo más caro, `tarifa_costo` y
`tarifa_amanecida`. El RLS de Postgres no filtra por columna, y los GRANT por columna
tampoco sirven porque todas las sesiones de la app son el mismo rol `authenticated`. Va en
un trigger: `11_cuartos_solo_el_estado.sql`.

Lo encontró **el propio gate al ampliarlo**, y solo porque la comprobación vuelve a leer la
fila con `service_role` en vez de mirar si hubo error: en UPDATE y DELETE el RLS que no deja
pasar una fila **no lanza error**, simplemente no afecta ninguna. Contar el error habría
dado un falso verde.


**`anon` podía ejecutar `current_tenant_id()`.** `01_schema.sql §12` hacía `revoke execute ... from anon`, pero Postgres otorga EXECUTE al rol `public` por defecto y `anon` hereda de `public`: revocarle algo que tiene por herencia no quita nada. No era una fuga —sin JWT la función devuelve null— pero el resto de las funciones de negocio quedaban igual de expuestas. Arreglado en `06_ejecucion_de_funciones.sql`, que revoca a `public`, otorga a `authenticated` y deja `resolver_login` como única excepción para `anon`.

### Los cuatro gates de `CLAUDE.md`

| Gate | Estado |
|---|---|
| 1 · RLS activado y testeado, aislamiento cross-tenant | ✅ 83 comprobaciones |
| 2 · `service_role` nunca en el cliente | ✅ Solo en scripts de terminal. Al navegador solo va la clave pública, y la prueba confirma que sin JWT no sirve para nada |
| 3 · Buckets R2 privados + URLs firmadas | ⚠️ Implementado, **sin ejecutar**: no hay cuenta de R2. Ver §9 |
| 4 · Consentimiento, retención y borrado (Ley 29733) | ⚠️ Igual: el código está, el camino no se ha corrido |

---

## 5. El asistente con IA

Híbrido, como manda `ADR-001 §3`: **reglas primero (gratis), Claude Haiku solo para lo que no reconocen.**

- 9 acciones: check-in, vender, entregar, comprar, reportar daño, cambiar estado, consultar cuarto, consultar stock, buscar huésped.
- **Conversación multi-turno**: si falta un dato, lo pregunta.
- **Nunca ejecuta solo**: propone una tarjeta, una persona confirma, y ejecutar es otra llamada donde se revalida todo.
- La tarjeta **no lleva monto**: el precio lo pone la base al ejecutar.

### Solo propone lo que ese rol puede ejecutar

Salió probando con la sesión de limpieza: el asistente aceptaba «llegó una pareja, doble, 2 noches», preguntaba habitación, nombre y **documento del huésped**, y al confirmar respondía «no tienes permiso». Cuatro preguntas para nada, y un dato personal recogido sin poder usarse — que es justo lo que la Ley 29733 no permite pedir «por si acaso».

Ahora el corte va **antes** de preguntar nada:

- `ACCIONES_POR_ROL` recorta el catálogo. Limpieza y mantenimiento se quedan con entregar, reportar daño, cambiar estado y las dos consultas.
- Al LLM solo se le ofrecen esas herramientas: un modelo que no ve `registrar_checkin` no puede proponerla.
- Si aun así llega una acción que no toca, responde a quién le corresponde: *«Eso lo hace recepción. Avísale y lo registra en un momento.»*
- Los chips de ejemplo también dependen del rol. A quien limpia ya no se le sugiere un check-in.

Es el reflejo de lo que la base ya exigía; lo que se evita aquí es empezar una conversación destinada a terminar mal.

### Las consultas responden con el dato

`¿cuánta agua queda?` devolvía «Hecho.». La regla reconocía la frase y ejecutaba bien; el
fallo era de interfaz: se tiraba el resultado y se pintaba un acuse. Preguntar cuánta
agua queda y que respondan «hecho» no es una respuesta.

Las tres consultas ahora redactan lo que devolvió la acción:

```
¿cuánta agua queda?   → Agua 500 ml: 40 unid.
¿la 205 está lista?   → La 205 está en "lista". Lista para check-in
¿se hospedó Laura?    → Laura Gómez (01020334)
```

Las que escriben siguen con el acuse: el resultado ya se ve en la pantalla que toca.

### Queda registrado quién escribió

`audit_log.origen` y `cuarto_estado_log.origen` distinguen tres cosas: `app` (una persona en la interfaz), `asistente` (una tarjeta de IA confirmada) y `sistema` (scripts). Antes el log decía que la 105 cambió de estado, pero no si lo pidió la IA o recepción.

El origen viaja en la cabecera HTTP `x-origen`, que PostgREST expone en `request.headers` y lee el trigger `fn_audit()`. **Por qué así y no con un parámetro**: `ejecutar()` del asistente llama a casos de uso de seis módulos, y cada uno abre su cliente varias capas más abajo; marcarlo una vez con `AsyncLocalStorage` (`shared/origen.ts`) es lo único que no obliga a tocar todas esas firmas. La cabecera se filtra contra una lista blanca en SQL: la puede poner cualquiera con un token válido, así que no se guarda texto libre.

Verificado de punta a punta: un cambio por el asistente queda como `asistente`, el mismo cambio por la interfaz como `app`, y el seed como `sistema`.

### Estado de verificación

✅ **El motor de reglas está probado**: 16/16 frases y el check-in conversacional completo contra la base real, con cero llamadas al LLM.

❌ **El camino de Haiku nunca se ha ejecutado.** Falta `ANTHROPIC_API_KEY` en `Backend/.env.local`. `GET /api/salud` dice si la clave está puesta.

---

## 6. Los tres roles

`plan.md` línea 42 pide «vista simplificada para limpieza (solo su lista de cuartos), permisos por rol». La matriz de navegación es la `ROLE_NAV` del prototipo, sin lo premium.

| | Administrador | Recepción | Limpieza |
|---|---|---|---|
| Entra en | Panel | Panel | Habitaciones |
| Panel · Caja · Alertas | ✅ | ✅ | — |
| Huéspedes · Reservas | ✅ | ✅ | — |
| Check-in · Inspección *(cajones)* | ✅ | ✅ | — |
| Habitaciones | rejilla, 7 estados | rejilla, 7 estados | **su lista, un botón** |
| Inventario | entregar · comprar · vender · aseo | igual | entregar · aseo |
| Limpieza · Asistente | ✅ | ✅ | ✅ |
| Asistente: acciones | 9 | 9 | **5** (§5) |
| Productos · Personas · Cuartos | ✅ | — | — |

`mantenimiento` existe en el esquema y sigue al mockup: asistente, habitaciones, inventario, alertas y limpieza. Usa la misma vista de piso que limpieza. Estaba mal: yo le había dejado solo dos secciones.

⚠️ **Trampa al tocar `navegacion.ts`**: los permisos de `administrador` salen de
`SECCIONES.map(s => s.clave)`. Check-in e inspección **no están en esa lista** —no se
listan en el menú—, así que van sumados aparte. Sacar una sección de `SECCIONES` sin
añadirla a `PERMITIDAS.administrador` se la quita también al administrador. Pasó.

### La vista de piso

La diferencia con la de recepción no es que se vea menos, es que **se decide menos**. Recepción elige entre siete estados porque tiene que poder corregir cualquier cosa; quien limpia con una tablet en la mano no elige: termina un cuarto y pasa al siguiente paso. Un botón de 44 px con el paso que toca — *Empezar a limpiar*, *Terminé de limpiar*, *Marcar como lista* — más *Reportar avería*, que es lo único que se sale del flujo y lo encuentra justo esa persona.

El resto del hostal aparece plegado y solo para mirar.

### La restricción es real, no cosmética

Hasta ahora el rol solo decidía qué salía en el menú. Un menú no es una puerta: `/caja` escrito a mano llegaba igual, y la API aceptaba cualquier cosa de cualquiera con sesión. `08_acciones_por_rol.sql` lo cierra donde importa:

- **`libre`, `ocupada` y `checkout`** los mueve solo quien maneja el dinero: van con el check-in y el cobro. Los otros cuatro son trabajo de piso.
- **`compra` y `ajuste`** de inventario, solo administración y recepción: mueven stock sin que haya pasado nada físico que otro pueda ver, y son la puerta por la que se tapa un descuadre. Entregar, mandar a lavandería y reportar daño se quedan abiertos a propósito — eso lo hace quien está limpiando.
- Y como las dos funciones son `SECURITY DEFINER`, la policy `cuartos_upd` se rehízo para que un `UPDATE` directo tampoco pase.

Lo comprueba el bloque 6 del gate, con la sesión real de una persona de limpieza.

---

## 6 bis. Lo que pidió el hostal

### Alerta antes de que se acabe algo

El aviso de reposición salía de **un 25 % del máximo fijado en el código**: el mismo umbral
para 120 rollos de papel que para 60 sábanas. Ahora cada producto lleva su `stock_min`, y
es quien maneja el hostal quien decide con cuánto todavía le da tiempo a comprar.

- **Rojo** al tocar el mínimo; **ámbar** a partir de `mínimo × 1.5`, para que el aviso llegue
  con margen y no el día que se acaba.
- Sin mínimo configurado (0) se mantiene la regla vieja: un producto que nadie tocó no se
  queda de golpe sin aviso.
- Aparece en cuatro sitios: el semáforo de **Inventario** y su filtro *Por reponer*, el
  resumen del **Panel**, una sección **Stock por reponer** en Alertas, y el punto rojo de la
  campana, que ahora suma descuadres sin revisar + productos bajo mínimo.
- Se edita en **Productos**, y solo el administrador puede: bajar un mínimo es la forma
  silenciosa de apagar una alerta.

La migración rellenó `stock_min` de los productos existentes con el 25 % que tenían de
hecho, para que nadie viera cambiar sus alertas por haber corrido una migración.

**El mínimo se elige contra el consumo, no contra el máximo.** El seed tenía el kit de aseo
en 20 y se gasta ~2 cada 14 días: era pedir stock para 140 días, y la tarjeta salía en rojo
diciendo «reponer» junto a «da para ~105 días» — la aplicación contradiciéndose en la misma
línea. Bajado a 8. Y en la tarjeta de Alertas los días de cobertura solo se muestran si son
30 o menos: manda el mínimo, que lo puso una persona, y una estimación que lo desmiente ahí
no ayuda.

### Nada se borra: se inhabilita, y vuelve

Ni cuartos ni tipos de cuarto se borran de la base — hay estadías cobradas, ventas y
auditoría apuntando a ellos. `activo` ya existía en las dos tablas y **nadie lo volvía a
poner en `true`**: dar de baja era un camino de ida.

- En `/admin/cuartos`, un botón de **inhabilitar** en cada cuarto y en cada tarjeta del
  tarifario — icono de prohibido, no papelera: una papelera promete que borra, y esto no
  borra. Al pie, una sección **Inhabilitados** con un botón *Habilitar* por fila.
- **Un tipo no se inhabilita si todavía lo usan cuartos activos**: dejaría cuartos
  apuntando a un tarifario que ya no se ofrece. Dice cuántos son.
- **Un cuarto no vuelve si su tipo sigue inhabilitado**: no tendría tarifa que cobrar.
  Vuelve como *Disponible*, nunca al estado en que se cayó.
- Un cuarto con estadía activa no se puede dar de baja: primero el check-out.
- Las tres reglas viven en SQL (`inhabilitar_tipo_cuarto`, `habilitar_tipo_cuarto`,
  `habilitar_cuarto`), no en TypeScript, así que tampoco se saltan por PostgREST.

### El administrador puede más, y se demuestra usándolo

Se cerraron dos agujeros reales (§4) y se sumaron 9 comprobaciones al gate. La diferencia
entre roles **se ve en el propio funcionamiento**: el menú de limpieza tiene 4 entradas, su
vista de piso decide menos, el asistente le ofrece 5 acciones de 9, y las rutas y la API
rechazan lo que no le toca.

Hubo una tabla de capacidades en `/admin/personas` y **se quitó a pedido**: la prueba real es
recorrer la app con cada rol, no un cuadro que hay que mantener al día a mano.

---

## 7. El frontend

**15 vistas**, todas devolviendo 200 con datos reales. Sistema Atlas portado de `design-tokens.css` e `index.html`.

`/` panel · `/asistente` · `/habitaciones` · `/checkin` · `/inspeccion` *(las dos, cajón; la ruta queda para enlaces directos)* · `/inventario` · `/caja` · `/limpieza` · `/alertas` · `/huespedes` · **`/reservas`** · `/admin/cuartos` · `/admin/productos` · `/admin/personas` · `/login`

### Cómo está montado

**Check-in por formulario** — el asistente de 4 pasos del prototipo, en un cajón lateral (§7): Huésped, Estadía, Habitación, Pago. Es la vía de respaldo del asistente conversacional. Dos diferencias con el mockup, ambas del `ADR-002`:

- El precio no se calcula en el cliente. El prototipo usaba constantes (`RATE_HOUR`, `RATE_NIGHT`); aquí se cotiza contra el tarifario del servidor en cuanto hay habitación elegida, y al confirmar la base lo vuelve a calcular.
- La habitación sale de `sugerir_cuarto()`, que solo devuelve las que de verdad admiten check-in y aguantan a esa gente.

**Inspección** (`/inspeccion`) — checklist post check-out, portado de `INSP`. En el mockup eran casillas de sí/no; aquí se **cuenta**, porque lo que el hostal necesita saber no es "¿había toallas?" sino "¿faltó una?". Guardar la inspección no descuenta inventario: el faltante se registra aparte y con motivo.

**Panel y barra superior, contra el mockup.** El dashboard tenía cuatro tarjetas y poco más; ahora lleva lo del mockup:

- **Resumen del día** en una frase: cuántos check-outs, cuántos check-ins, cuántas por preparar y qué insumo se acaba antes. El mockup lo etiquetaba «Resumen de IA · alta confianza»; este lo arman reglas sobre los datos del turno, sin llamar a ningún modelo, así que se llama **Resumen del día** y lo dice al pie. Etiquetarlo como IA sería mentir en la propia pantalla.
- **Cuatro tarjetas** con las métricas del mockup: check-outs y check-ins de hoy, habitaciones listas y ventas frente a ayer.
- **Minigráficas de 14 días**, pero solo donde hay histórico que reconstruir. El mockup dibujaba cuatro con datos inventados; «habitaciones listas» va sin ella porque no se puede calcular sin recorrer el log de estados.
- **Consumo del hostal**: productos más consumidos y tipo de cuarto más frecuente, con barra proporcional.
- **Mapa de habitaciones** con leyenda de colores, ordenado por lo que hay que atender antes.
- **Barra superior**: el **Check-in** pasa a la esquina superior derecha como acción principal —ya no está en el menú lateral, igual que en el mockup— y se suma la campana, con punto rojo cuando hay incidencias sin revisar.
- **El menú lateral es el del mockup, en su orden**: Panel · Asistente IA (con la insignia «IA») · Habitaciones · Inventario · Caja · Limpieza · Alertas | Huéspedes · Reservas | Productos · Personas · Cuartos. Y el buscador repetido al pie, que es el mismo Ctrl+K.
- **Check-in e Inspección no están en el menú**: son cajones laterales que se abren desde donde tienen sentido — el check-in desde la esquina superior derecha, la inspección desde las acciones rápidas de una habitación (`openInspeccion()` en el mockup). Se inspecciona *un cuarto concreto* mientras se lo está mirando; mandar a una pantalla aparte obligaba a elegirlo otra vez.
- **El check-in es un cajón lateral**, no una página. Recepción tiene a alguien delante del mostrador y estaba mirando otra cosa: abrirlo encima y cerrarlo deja la pantalla donde estaba. Se abre desde el botón de la esquina, desde el panel de una habitación libre y desde Ctrl+K, todos con el mismo evento. `/checkin` sigue existiendo como página para enlaces directos: es el mismo componente, sin la tarjeta.

Fuera por premium: la corona de Premium y la alerta de «activo fuera de zona», que es RFID (`plan.md` la pone en el núcleo del plan Premium).

**Reservas** (`/reservas`) — el mockup tenía la sección con un estado vacío y dos botones; `plan.md` la dejaba pendiente («Vista Reservas completa: calendario/lista»). La tabla ya existía en el esquema desde el principio. Ahora es lista, alta, confirmar, cancelar y marcar que no se presentó.

Una decisión de producto que conviene saber: **una reserva no bloquea la habitación.** Hasta que alguien llega y hace el check-in, el cuarto se puede vender — en un hostal, bloquear al reservar es regalar noches a la mitad de la gente que no aparece. Por eso se reserva un *tipo* de cuarto y el número concreto se asigna al llegar.

**Command palette (Ctrl+K)** — sale de la misma lista que el menú, así que no hay dos sitios donde recordar quién ve qué.

**Panel de una habitación, completo.** Portado de `openRoom()`: bloque de datos 2×2 (huésped, próxima reserva, aforo y tarifa, última limpieza), las siete píldoras de estado con icono, seis acciones rápidas y el botón principal al pie. Dos diferencias con el mockup:

- Allí el bloque de datos era fijo para cualquier habitación («Última limpieza: Hoy · 09:40»). Aquí sale de la estadía activa, del historial de estados y de la tabla de reservas — y **lo que no existe se dice**: como no hay reservas cargadas, pone «Sin reservas».
- Las acciones rápidas del mockup mandaban una frase al asistente; estas ejecutan. *Agregar toalla* y *Reponer papel* entregan al cuarto de verdad, y solo aparecen si el hostal tiene ese producto en el catálogo.

Ahí vive también el **check-out**, que no estaba en ninguna parte: `registrarCheckout` existía en el backend y en el frontend, y ningún botón lo llamaba. No se podía cerrar una estadía desde la aplicación.

**Realtime del estado de cuartos** — recepción pone la 203 en limpieza y la tablet de limpieza lo ve sin recargar. Va directo del navegador a Supabase con la clave pública: un WebSocket no se puede reescribir por `next.config`. No se aplica lo que llega por el socket — se llama a `router.refresh()` y los datos vuelven a salir del backend, para que el RLS siga siendo la única fuente de verdad. El token se vuelve a pasar al socket en cada refresco: dura una hora y un turno dura más.

**PWA instalable** — service worker + iconos PNG de 192/512 + maskable + `shortcuts`. El worker **no cachea `/api/*`** a propósito: un cuarto "libre" servido desde caché lleva a dos check-ins en la misma habitación, y una respuesta guardada quedaría legible para quien use el equipo después. Sin red sale `sin-conexion.html`, que dice la verdad en vez de mostrar datos viejos. Solo se registra en producción.

**`loading.tsx`** — los cuatro estados de Atlas (cargando, vacío, error, con datos) ya están los cuatro.

**Guardias de rol por ruta** — el menú ya no mostraba lo que no toca, pero escribiendo la URL se llegaba igual. `exigirSeccion()` usa la misma lista `PERMITIDAS` que el menú. Sigue siendo cortesía, no seguridad: quien protege es el RLS.

**Tarifario editable** — era la única pantalla de administración sin escritura:
`guardarTipoCuarto` existía en el backend pero **no tenía ruta HTTP**. `plan.md` lo pedía
explícito: «el precio del check-in debe tomar el tarifario que configuren Admin y
Recepción, no valores hardcodeados». Ahora hay un lápiz en cada tarjeta del tarifario, y
lo que se cambia ahí es lo que cotiza el siguiente check-in.

**El nombre del hostal** — el sidebar decía "Hostal Aurora" fijo. En una app multi-tenant eso es un bug: el segundo hostal habría visto el nombre del primero.

---

## 8. Lo que encontró la validación en el navegador

Recorrido completo por los trece módulos, con los tres roles, hecho por una persona en
Chrome. Es la primera vez que la aplicación se mira de verdad, y salieron **cinco fallos
reales** que ninguna prueba automática había tocado. Todos arreglados.

| Qué se vio | Qué era | Dónde se arregló |
|---|---|---|
| El conteo de cierre pedía «Debería haber **−2** unid.» y el campo no aceptaba negativos | `esperado = apertura + movimientos`. La apertura sale del snapshot del turno, indexado por id de producto. `seed --limpiar` con el turno abierto recreaba los productos y dejaba el snapshot huérfano: apertura 0, pero las ventas seguían restando | `09_esperado_no_negativo.sql` (recorta en 0) + el seed se niega con un turno abierto |
| El Panel decía «Agua da para ~53 días» cuando el crítico era el papel al 18 % | `porAcabarse` solo miraba días de cobertura, y el papel no tenía consumo registrado: se lo saltaba. Justo el que había que ver | Un producto bajo el 25 % gana aunque otro tenga menos días; sin consumo dice «está al 18 %» |
| El asistente respondía «Hecho.» a `¿cuánta agua queda?` | La regla funcionaba; la interfaz tiraba el resultado | §5 |
| El tarifario no se podía editar | La función existía sin ruta HTTP | §7 |
| `seed --limpiar` decía «Borrando datos previos…» y no borraba | `turno_conteos` apunta a `productos` con `on delete restrict` y no estaba en la lista. **Y ningún `delete` comprobaba su error**: falló en silencio y el script siguió como si nada | §2 |

El último es el que más enseña: el fallo visible era la tabla que faltaba, pero el fallo
de fondo era **no mirar el error**. Eso es lo que dejó que el primero pasara desapercibido
durante días.

### Dos que cazó el linter, no la vista

`eslint` con las reglas de React encontró lo que ningún clic habría reproducido a la
primera:

- **Un componente definido dentro del render.** El marco del checklist de inspección se
  declaraba dentro del componente, así que React lo trataba como un tipo nuevo en cada
  render y **remontaba el árbol entero**: se perdía el foco del textarea al escribir la
  nota. Ahora vive fuera y recibe `enCajon` como prop.
- **Seis `setState` síncronos dentro de efectos** (Ctrl+K, el check-in, el hook de
  Realtime). Cascada de renders. Arreglados de raíz —la lista de acompañantes se actualiza
  en el manejador del contador, la paleta limpia la búsqueda al cerrar, el estado «sin
  conexión» se calcula antes del primer render— y no silenciando la regla.

Por eso `npx eslint src/` es parte de dar algo por terminado, no un extra.

### Lo que se confirmó que funciona

Check-in de cuatro pasos con el precio saliendo del tarifario · check-out · inspección con
conteo · ciclo de lavandería · cierre de turno con justificación obligatoria e incidencia ·
reservas con sus cuatro estados · el asistente por reglas · la vista de piso de limpieza ·
las guardias de rol · Realtime entre dos navegadores.

### Cómo volver a validarlo

Con la base recién sembrada (§2) y un turno abierto desde Caja:

| Módulo | Qué hacer | Qué tiene que pasar |
|---|---|---|
| Panel | mirar | Ocupación 3 de 9 · el resumen nombra **Papel higiénico al 18 %** |
| Asistente | `¿cuánta agua queda?` | Responde **40 unid.**, no «Hecho» |
| Asistente | `la 203 ya está limpia` | La saca de limpieza a **inspección**, no al revés |
| Cuartos | lápiz en Matrimonial, noche a 120 | El check-in de la 205 a 2 noches cotiza **S/ 240** |
| Check-in | botón de la esquina, 205, 2 noches | Paso 3 ofrece la 205 y cotiza **S/ 200** |
| Habitaciones | 204 → Acciones rápidas → Iniciar inspección | Cajón; baja Toallas de 2 a 1 → aviso ámbar → la 204 pasa a limpieza |
| Inventario | tras la inspección | **Toallas no bajó**: el faltante se registra, no se descuenta |
| Habitaciones | 102 → Registrar check-out | Pasa a *Check-out*, no a disponible |
| Inventario | Aseo en Toallas | 38 → 37, aparece en Limpieza; *Listo* y vuelve a 38 |
| Caja | cerrar declarando menos agua | Exige justificación → incidencia → campana roja |
| Reservas | crear una con fecha de ayer | Sale marcada *Sin resolver* en rojo |
| Huéspedes | buscar `Laura` | Marca de revisión, con texto neutro (nunca «lista negra») |
| Personas | desactivarte a ti misma | «No puedes desactivar tu propia cuenta» |
| Roles | Marta en incógnito | Menú de 4, sin Check-in arriba, sin Comprar; `/caja` a mano rebota |
| Realtime | dos navegadores en Habitaciones | Cambia solo, sin recargar |

Y la que no depende de la interfaz — con Marta, en la consola:

```js
await fetch('/api/cuartos', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cuarto_id: 'ID_DE_UN_CUARTO', estado: 'ocupada' })
}).then(r => r.json())
```

Tiene que responder que ese estado lo cambia recepción.

---

## 9. Fotos en Cloudflare R2

`ADR-001 §3` deja claro que **las fotos son de todos los planes** (solo el video es premium), así que entran en el plan básico y las cubre el gate #3.

**Implementado, nunca ejecutado.** No hay cuenta de R2: `GET /api/salud` responde `"medios": "sin configurar"` y `POST /api/medios` corta antes de tocar nada.

Mientras no haya claves, el control de foto no se pinta (`CapturaFoto` consulta `/api/salud`): un botón que solo puede devolver el nombre de las variables que faltan no es algo que deba ver quien está en el mostrador. Con las claves puestas, reaparece solo.

Cómo funciona:

- El archivo **no pasa por el backend**. El servidor firma un permiso de subida corto (120 s) y el navegador hace el `PUT` directo al bucket. Ni tránsito ni memoria del servidor con imágenes.
- **El tipo y el tamaño van firmados** en la URL: sin eso, el permiso sirve para subir cualquier cosa de cualquier peso.
- La llave del objeto empieza por el `tenant_id`. Para leer, `GET /api/medios?id=` firma una URL de 5 minutos — y solo si el RLS deja leer esa fila, así que una foto ajena no tiene llave que firmar.
- **Compresión a ~150 KB en el navegador** (`ai-media.md`): una foto de móvil son 4 MB, subirla entera por el wifi del hostal para encogerla después sería pagar el ancho de banda dos veces.
- **Ley 29733**: `dni` y `rostro` exigen consentimiento registrado antes de subir; cada tipo tiene su plazo de retención y `npm run purgar:medios` borra lo vencido (con `--simular` para ver qué se iría).

Dónde se usa: foto de la inspección, y foto del documento en la pantalla de confirmación del check-in — ahí y no antes porque hasta que el check-in no está hecho no hay huésped al que asociarla.

**Para activarlo**: crear el bucket privado en Cloudflare y rellenar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` en `Backend/.env.local` (las líneas ya están, comentadas).

---

## 10. Superficie del backend

**20 rutas** en `Backend/src/app/api/`. `GET /api/cuartos?id=` devuelve el detalle que llena el panel lateral; `POST` da de alta o edita un cuarto y `DELETE` inhabilita o vuelve a habilitar cuartos y tipos. `POST /api/productos` con `id` edita. **Swagger en <http://localhost:3000/docs>** (404 en producción; se reabre con `HABILITAR_DOCS=1`).

`salud` · `auth` · `asistente` · `panel` · `cuartos` · `productos` · `inventario` · `aseo` · `huespedes` · `checkin` · **`inspecciones`** · **`reservas`** · **`medios`** · **`catalogos`** · **`tarifa`** · `ventas` · `turno` · `incidencias` · `personal` · `openapi`

Las 19 documentables están en `openapi.ts`, sin referencias rotas (`openapi` no se documenta a sí misma). Al tocar una ruta hay que actualizarlo en el mismo commit.

---

## 11. Contraste contra los tres documentos de agente

### `backend.md`

| Pedido | Estado |
|---|---|
| Esquema Postgres completo | ✅ 27 tablas |
| RLS por `tenant_id` en TODAS + políticas | ✅ 27/27 |
| **Probar aislamiento cross-tenant** | ✅ 83 comprobaciones, §4 |
| Supabase Auth DNI+PIN, 4 roles | ✅ |
| Route Handlers tipados | ✅ 19 rutas |
| `service_role` nunca en el cliente | ✅ |
| **Migraciones versionadas** | ✅ `_migraciones` + sha256 |
| **Migrar `ROOMS/INV/GUESTS/STAFF/TURNO/INCIDENCIAS`** | ✅ `TURNO` e `INCIDENCIAS` arrancan vacíos en el prototipo; aquí también |
| **R2 + URLs firmadas (buckets privados)** | ⚠️ Escrito y tipado, sin ejecutar (§9) |

### `frontend.md`

| Pedido | Estado |
|---|---|
| Next + TS + Tailwind, tokens Atlas | ✅ |
| Portar las `view-*` | ✅ 13 de 14 — falta **Integraciones**, que es premium |
| **PWA instalable** | ✅ service worker + iconos |
| **Realtime de estado de cuartos** | ✅ |
| **Command palette (Ctrl+K)** | ✅ |
| Toggle de tema | ✅ |
| **Estados loading / empty / error** | ✅ los cuatro |
| Español neutro, accesibilidad | ✅ foco visible, color+ícono, `prefers-reduced-motion` |

### `ai-media.md`

| Pedido | Estado |
|---|---|
| Motor híbrido reglas + Haiku, tool-use → JSON | ✅ |
| Prompt caching | ✅ en el prefijo del catálogo |
| Confirmación humana antes de escribir | ✅ |
| **Registrar en auditoría** | ✅ `origen`, §5 |
| Etiquetar "Generado por IA" | ✅ |
| Clave solo en servidor | ✅ `import 'server-only'` |
| Control de costo | ✅ las reglas absorben casi todo |
| **Pipeline de fotos (~150 KB → R2 firmado)** | ⚠️ Escrito, sin ejecutar (§9) |
| **OCR de DNI y facturas** | ❌ A propósito: `ADR-001 §8` deja el proveedor como **pregunta abierta**. Elegirlo aquí sería decidir por el ADR |
| **Video premium (clips, H.265, ciclo de vida)** | ❌ Plan premium, y necesita NVR en el hostal (`ADR-001 §3`) |

---

## 12. Cosas que conviene saber

- **`.env.local` de ambas apps está fuera de git.** El backend necesita las claves de Supabase (y las de R2 cuando existan); el front necesita `BACKEND_URL` **y las dos `NEXT_PUBLIC_*` de Supabase** para el Realtime. Sin ellas la app funciona igual, solo pierde el "en vivo".
- **Next 16 regenera `AGENTS.md` y `CLAUDE.md`** dentro de `Backend/` y `Frontend/` en cada `next dev`.
- **Git Bash en Windows corrompe los acentos** al pasar JSON inline con `curl -d`. Usar `--data-binary @archivo` o `fetch` de Node.
- **Nada se ha commiteado todavía**: `Backend/`, `Frontend/`, `Database/` y `ADR-002` están sin seguimiento.
- **La UI ya se validó en Chrome**, módulo por módulo y con los tres roles (§8). Desde este entorno no hay navegador: lo que se verifica aquí es el HTML servido, el CSS generado y los redirects. Los píxeles y el Realtime entre pestañas los mira una persona.
- **Los scripts de `Database/` se aplican con el runner, nunca a mano.** Editar una migración ya aplicada hace que `npm run migrar` se plante, que es lo que se quiere. Existe `--forzar` para reaplicarla; se usó **una vez**, sobre la 08, minutos después de crearla y con esta base como única que la tenía. Si ya está en otra máquina, la respuesta es una migración nueva, no `--forzar`.
- **Supabase tipa las relaciones incrustadas como arreglo** aunque sean 1:1: `cuartos(numero)` devuelve `{ numero }` en ejecución pero el tipo dice `{ numero }[]`. Para eso está `shared/supabase/embebido.ts` con `uno()`. Normalizarlo a mano en cada consulta era ruido repetido en tres módulos.
- **Realtime sin sesión entrega un sobre vacío, no silencio.** `anon` recibe el evento con `new` y `old` en `{}` y `errors: ["Error 401: Unauthorized"]` — el RLS le quitó todas las columnas. Al probar el aislamiento hay que comprobar **que no llegan filas**, no que no llegan mensajes: contar sobres da un falso positivo de fuga.
- **En UPDATE y DELETE, el RLS que bloquea no lanza error**: simplemente no afecta ninguna fila. Para comprobar que algo quedó protegido hay que **volver a leer la fila** con `service_role`; mirar `error` da un falso verde. Es lo que escondía los dos agujeros de §4.
- **Un `<button>` sin `type` dentro de un `<form>` es `submit`.** Lo vigila `react/button-has-type` en el eslint del front, activado a propósito: es un fallo que no se ve leyendo el código y que en Inventario cobraba una venta al elegir el medio de pago.
- **`toLocaleString` rompe la hidratación** y, peor, formatea en la zona del servidor. Todo el formato de fechas pasa por `shared/ui/fechas.ts`, que fija `America/Lima` y arma el texto a mano. No volver a llamar a `toLocale*` en componentes.
- **`(sesion)` es un route group**, no un segmento de URL: los paréntesis son lo que hace que no aparezca. `(sesion)/habitaciones` se sirve en `/habitaciones`. Está para que todo lo de dentro comparta el chasis y la exigencia de sesión, y `/login` quede fuera. Quitarle los paréntesis movería cada ruta a `/sesion/...`.

---

## 13. Siguiente paso recomendado

1. **Commitear.** Nada de esto está en git todavía y ya es mucho trabajo sin respaldo.
2. **Cuenta de Cloudflare R2** para poder ejecutar el camino de fotos y cerrar los gates #3 y #4 de verdad.
3. **Cargar crédito en Anthropic** y verificar Haiku cuando haya fecha de demo. Cuesta céntimos, pero es código sin ejecutar.
4. **Colgar `npm run prueba:aislamiento` de CI.** Sale con código 1 si algo falla; ahí es donde sirve.
5. Cuando toque decidirlo: **ADR-003 para el proveedor de OCR** (`ADR-001 §8` lo dejó abierto).

---

## 14. Qué NO está en este documento

Esto es un traspaso, no una transcripción. Se ha dejado fuera, a propósito:

- **El diálogo** de las sesiones de trabajo. Lo que sobrevive es la decisión y su porqué,
  que es lo que hace falta para seguir; el camino hasta ella no.
- **Los intentos fallidos y los rodeos** — salvo cuando enseñan algo, y entonces están en
  §8 y §12 como trampas, no como anécdota.
- **Lo que ya está escrito en otro sitio.** El stack está en `ADR-001`, la arquitectura
  interna en `ADR-002`, las reglas en `CLAUDE.md`, el pendiente del prototipo en
  `plan.md`. Este documento no los repite: los referencia.

Si algo de lo que hay aquí contradice a un ADR, **manda el ADR** — y hay que abrir uno
nuevo para cambiarlo, no editar este archivo.
