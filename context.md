# Contexto del proyecto — Hostal Inteligente (Atlas)

> Documento de contexto. Resume **qué es**, **cómo está construido** y **por qué**, con el estado a **2026-08-04**. Léelo antes de tocar el código.

---

## 1. Qué es

Prototipo **front-only** (sin backend) de un **sistema de gestión de hostales pequeños/medianos con IA como núcleo**. Es un mockup **funcional y navegable** para presentar al cliente; todo el estado vive en memoria (JavaScript), no hay persistencia ni servidor.

**Idea central:** la IA es la forma principal de trabajar, no un chatbot añadido. El usuario escribe / habla / envía foto en lenguaje natural → la IA propone una **tarjeta de acción con datos estructurados** → una persona **confirma**. Los formularios clásicos existen como respaldo.

**Público objetivo:** personal de hostal con poca experiencia técnica (recepción, limpieza). Prioridad: claridad, lenguaje amigable, objetivos táctiles grandes.

**Idioma / moneda:** español latinoamericano · **Soles peruanos (S/)**.

---

## 2. Archivos del entregable

Ubicados en `C:\Users\Usuario\Documents\Massive\Hotel\`:

| Archivo | Qué es |
|---|---|
| `hostal-atlas.html` | **Entregable principal.** Prototipo completo en el design system "Atlas" (dark/light). Un solo archivo autónomo (Tailwind CDN + Lucide + JS vanilla). Se abre con doble clic. |
| `design-tokens.css` | Fuente de verdad de tokens (paleta, tipografía, espaciado, radios, elevación, motion) + overrides de tema claro/oscuro. |
| `hostal-inteligente.html` | Primer mockup cálido/claro (inspirado en Stitch y figma). Se conserva solo para comparar direcciones. **No es la línea actual**, pero de aquí se recuperaron: el layout de tarjetas de habitación, el estilo de filtros y el lenguaje amigable del asistente. |
| `context.md` / `plan.md` | Copias del contexto y plan dentro del proyecto. |

### Material de origen (input, no editar)
- `C:\Users\Usuario\Downloads\prompt_stitch_sistema_hostales_ia (1).md` — brief del producto.
- `C:\Users\Usuario\Downloads\stitch_hostal_ia_asistente_operativo.zip` — mockups estáticos de Google Stitch.

---

## 3. Stack y arquitectura

- **HTML único** + **Tailwind (CDN)** con `tailwind.config` inline + **Lucide** (íconos, una sola familia) + **Inter** + **JS vanilla**. Sin build ni dependencias locales.
- **SPA por vistas**: `go('vista')` alterna `<section class="view">`. Estado en variables JS (`ROOMS`, `INV`, `GUESTS`, `INTEGR`, `PREMIUM`, estado del check-in, etc.).
- **Colores vía variables CSS** (`--canvas`, `--raised`, `--tx`, `--elev-*`, …) mapeadas en `tailwind.config`, lo que permite conmutar tema con `data-theme` en `<html>`.

---

## 4. Design system "Atlas" (dirección visual)

**Filosofía:** dark-first, premium, "engineered", minimal. Jerarquía sobre decoración. Balance de color **90 % neutral / 8 % acento / 2 % semántico**. Sin `#000` / `#FFF` puros.

### Paleta oscura (HEX tipo Figma, pedido del cliente)
| Rol | HEX |
|---|---|
| Lienzo / paneles | `#1E1E1E` |
| Toolbar / sidebar / cards | `#2C2C2C` |
| Hover | `#383838` |
| Pressed | `#424242` |
| Bordes y líneas | `#444444` |

### Paleta clara
Lienzo `#F5F5F5` · superficies `#FFFFFF` · hover `#ECECEC` · bordes `#E4E4E4`.

### Acentos (iguales en ambos temas)
- **Marca (verde):** `#1BD96A` / `#18C25E` / `#14A34F` — solo **una acción primaria por sección**.
- **Premium (dorado):** `#E9A93B` / `#F5C451` — reservado a lo premium; nunca compite con el verde.
- **Semánticos:** danger `#EF4444` · warning `#F59E0B` · success `#22C55E` · info `#3B82F6`. Siempre con **ícono + texto**, nunca solo color.
- **Texto:** claro→oscuro según tema (`#F1F3F4`…`#5A5F64` / `#1A1D1F`…`#AEB3B9`).

### Tipografía
**Inter** (única familia). Jerarquía por peso/tamaño. Escala: Display 40 · H1 30 · H2 24 · H3 20 · Title 18 · Body 14 · Small 13 · Caption 12. Pesos 400/500/600/700.

### Otros tokens
Espaciado escala-4 (4/8/12/16/24/32/48/64) · radios 4–20 · motion `cubic-bezier(.2,.8,.2,1)` (120/180/250 ms) · **elevación Material** (sombras por capas, theme-aware — §6).

---

## 5. Funcionalidades implementadas (`hostal-atlas.html`)

**Marco (chrome):** sidebar agrupado (Operación / Gestión / Seguridad), topbar (título, fecha, buscador **Ctrl K**, corona **Premium**, toggle de tema, campana, botón Check-in), **bottom nav** en móvil con animaciones, **barra de asistente IA fija** en todas las vistas, contenido **centrado** (máx. 1536 px) para verse bien de móvil a ultrawide.

**Tema claro/oscuro:** toggle con **animación sol⇄luna**, persiste en `localStorage`, aplicado antes del render (sin parpadeo).

**Vistas:**
- **Panel:** saludo + resumen de IA (con nivel de confianza), banner de alerta crítica, 4 stat-cards con sparklines, **Prioridades de IA** (Aceptar/Descartar/Explicar), mini-mapa de habitaciones.
- **Asistente IA:** **lenguaje amigable** — intro "Escribe, habla o envía una foto. Yo preparo la acción y tú solo confirmas." y chips con frases naturales completas (“Llegó una pareja, doble, 2 noches, efectivo”, “A la 203, 2 toallas y 1 rollo”, “¿La 105 está lista?”, “¿Se hospedó antes?”). Chat con indicador de "escribiendo", **tarjetas de confirmación** etiquetadas "Generado por IA"; las acciones sensibles (cobros/compras/incidentes) exigen confirmación explícita.
- **Habitaciones:** encabezado con título + subtítulo y **filtros tipo píldora** en fila (con conteo entre paréntesis: `Todas (9)`, `Lista (2)`…; activa en alto contraste). **Tarjetas** con franja de color a la izquierda, número grande, chip de estado tipo píldora, tipo y nota (sin foto de fondo, layout recuperado de la versión anterior). Grid de 4 columnas. **Drawer de detalle** con acciones rápidas (toalla, papel, inspección, daño, limpia).
- **Inventario:** niveles con barra + días de cobertura + sugerencia de compra de IA.
- **Huéspedes:** tabla (estado como columna líder) + **drawer** con línea de tiempo, resumen de IA e incidentes con lenguaje seguro (nunca "lista negra"; requiere evidencia + validación humana).
- **Reservas:** empty state.
- **Alertas e incidentes:** incidente crítico con vista previa de cámara (solo zonas comunes) y acciones validar/escalar; la IA pausa el evento para revisión humana.
- **Integraciones:** módulos base vs **premium bloqueados** + switches (theme-aware) + historial de eventos.

**Check-in (asistente de 4 pasos):** Huésped → **Estadía** → Habitación (sugerida por IA) → Pago.
- El paso **Estadía** deja elegir de forma amigable: **por horas** (chips 3/6/12 h) · **por 1 día** · **rango de días** (contador de noches). Fechas y precio se **calculan solos** (salida = entrada + noches y viceversa). Moneda en **S/**: hora S/ 12, noche S/ 75, depósito S/ 40. El total se propaga a Pago y a la confirmación.

**Inspección post check-out:** checklist esperado vs confirmado, foto/nota de voz, renovación sugerida por IA (no descuenta inventario sin confirmar).

**Premium (suscripción, mockup):** corona **"Premium"** en la topbar (junto al buscador) + banner en Integraciones + modal con precio **S/ 89/mes (referencial, "Próximamente")**, beneficios en **lenguaje simple no técnico** (explica RFID en palabras cotidianas). CTA "Quiero afiliarme" (lista de espera) + "Ver cómo se vería activado" (demo que desbloquea). Accesible desde **Ctrl K**.

**Command palette (Ctrl K / ⌘K en Mac):** buscador de acciones, con **navegación por teclado** (↑ ↓ para moverse, Enter para ejecutar, Esc cerrar) y también con mouse; pie con la ayuda de atajos. El atajo se muestra como **Ctrl K** en Windows y ⌘K en Mac.

**Transversal:** toasts, skeleton de carga, estados loading/empty/error/populated, animaciones de bottom nav (hover eleva el ícono, clic da feedback de presión, "pop" al activarse).

---

## 6. Decisiones y principios

- **Leyes de UX aplicadas** (lawsofux.com + leyes Atlas de los docs): Jakob (patrones admin conocidos), Hick/Miller (nav en 3 grupos, ≤5 datos por card), Fitts (targets ≥40 px), Von Restorff (un solo acento por bloque), Aesthetic-Usability + Doherty (skeleton <650 ms, feedback inmediato), proximidad/whitespace.
- **Coherencia de componentes** según `docs/03-components` y `docs/05-ai-engine`: un primario por sección; estado antes que descripción; 4 estados obligatorios; etiquetar salida de IA como IA.
- **Sombras Material:** elevación por capas en cards y botones (reposo 1dp, hover 4dp, botones 2→4→8dp). ⚠️ Los docs Atlas marcan "evitar sombras decorativas"; se resolvió combinando **sombra + borde hairline**, y theme-aware (negro canónico en claro; reforzado en oscuro porque el negro no se ve sobre `#1E1E1E`). Se apaga con una sola variable si se quiere look plano.
- **Accesibilidad:** focus visible, `aria-*`, color nunca como único indicador, `prefers-reduced-motion` respetado.

---

## 7. Puntos abiertos / a reconciliar

- **Ubicación vs moneda:** el header dice "Hostal Aurora, **Medellín**" pero la moneda es **Soles (Perú)**. Falta unificar (probablemente cambiar la ciudad a una peruana).
- **Imágenes externas:** avatares (`i.pravatar.cc`) y la vista previa de cámara (Unsplash) requieren internet; hay fallback de color. Las fotos de habitación ya se quitaron.
- **Premium y RFID son demostrativos** ("Próximamente"); no procesan pagos ni hay dispositivos reales.
- **Sin backend / auth / roles reales** (ver `plan.md`).
