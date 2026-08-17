# Plan de trabajo — Hostal Inteligente (Atlas)

> Estado a **2026-08-04**. Ver `context.md` para el detalle de lo construido.

---

## Estado general

**Fase actual:** Prototipo de UI/UX front-only (presentación a cliente). ✅ Funcional y navegable en `C:\Users\Usuario\Documents\Massive\Hotel\hostal-atlas.html`.
**Siguiente hito:** validar con el cliente → definir alcance del MVP con backend.

---

## ✅ Hecho

### Fundamentos
- [x] Design system "Atlas" traducido a tokens reales (`design-tokens.css`).
- [x] Paleta oscura tipo Figma (`#1E1E1E` / `#2C2C2C` / `#383838` / `#444`) + paleta clara (`#F5F5F5`).
- [x] Tipografía Inter con escala modular; espaciado, radios, motion y **elevación Material** (theme-aware).
- [x] Sistema de temas conmutable (variables CSS + `data-theme`) con **toggle animado y persistencia.

### Prototipo (`hostal-atlas.html`)
- [x] Marco: sidebar agrupado + topbar + bottom nav (móvil, animado) + barra de IA fija + contenido centrado (máx. 1536 px).
- [x] Panel/dashboard: stat-cards con sparklines, prioridades de IA, mini-mapa de habitaciones, alerta crítica.
- [x] Asistente IA con **lenguaje amigable** (intro + chips de frases naturales) y tarjetas de confirmación (sensibles ⇒ confirmación explícita, etiquetadas "Generado por IA").
- [x] Habitaciones: **filtros tipo píldora** con conteo + **tarjetas con layout recuperado** (franja de color, número grande, chip de estado) + grid 4 col + drawer de detalle con acciones rápidas.
- [x] Inventario con cobertura estimada y sugerencia de compra.
- [x] Huéspedes (tabla + perfil con timeline, resumen de IA, incidentes con lenguaje seguro).
- [x] Alertas e incidentes (crítico con validación humana).
- [x] Integraciones (base vs premium) + historial de eventos + switches theme-aware.
- [x] Check-in en 4 pasos con **estadía por horas / día / rango**, cálculo dinámico de fechas y precio en **S/**.
- [x] Inspección post check-out (esperado vs confirmado).
- [x] **Premium**: corona en topbar + banner + modal (S/, "Próximamente", lenguaje simple) + acceso por Ctrl K.
- [x] **Command palette (Ctrl K)** con navegación por teclado (↑ ↓ Enter Esc) y por mouse.
- [x] Toasts, skeleton, estados loading/empty/error/populated, responsive móvil→ultrawide.

---

## 🔜 Pendiente — corto plazo (pulido del prototipo)

- [ ] **Reconciliar ubicación/moneda**: el header dice "Medellín" pero se usan Soles → unificar a contexto peruano.
- [ ] **Roles de usuario** (recepción / limpieza / administrador / mantenimiento): vista simplificada para limpieza (solo su lista de cuartos), permisos por rol.
- [ ] **Vista Reservas completa** (hoy es empty state): calendario/lista.
- [ ] **Onboarding de 30 s** la primera vez ("puedes escribir, hablar o tomar foto").
- [ ] **Segundo plan Premium** más económico (opción de elegir mensual/anual).
- [ ] Consistencia fina: aplicar el estilo de píldora activa a otros segmentos (p. ej. selector de estadía en check-in).
- [ ] Fallback offline para imágenes (avatares/cámara) sin internet.
- [ ] Repaso de accesibilidad (contraste en claro, foco, lectores de pantalla) y textos.

---

## 🧭 Mediano plazo (hacia MVP real)

- [ ] **Migrar a stack productivo** (React/Next o Vue) con componentes reutilizables a partir de los tokens.
- [ ] **Backend + persistencia** (reservas, habitaciones, inventario, huéspedes, auditoría).
- [ ] **Autenticación / login** y gestión de sesión por rol.
- [ ] **IA real**: NLP para interpretar comandos y generar las tarjetas de acción (hoy es simulado por reglas).
- [ ] Motor de **inventario** (compra, entrega, lavandería, daño, pérdida, ajuste, devolución) con auditoría.
- [ ] **Pagos reales** para la suscripción Premium (pasarela en Soles).
- [ ] **Tarifas del check-in desde la configuración de Admin/Recepción** (decisión 2026-08-06): hoy el prototipo cobra el check-in con constantes fijas (modelo viejo: por hora/noche) y se deja así a propósito. En el desarrollo real, el precio del check-in **debe tomar el tarifario que configuren Admin y Recepción** por tipo de cuarto (costo por bloque de horas + amanecida, con diferencia L–J / V–D; ver `tarifaOf()` y `TARIFA_DEF`), no valores hardcodeados. Marcado en el código con `// [BACKEND]` en `stayInfo()`.

---

## 🔭 Largo plazo (diferenciadores)

- [ ] **Integraciones de seguridad reales**: cerraduras inteligentes, cámaras zonas comunes, sensores de puerta, sensor de manipulación de TV.
- [ ] **RFID de activos** (rastreo de toallas/TV/controles) — núcleo del plan Premium.
- [ ] **Reconocimiento facial** opcional, con consentimiento y **siempre** revisión humana.
- [ ] Verificación de identidad en check-in (foto/selfie) con alternativa manual.
- [ ] Reportes/analytics de ocupación y consumo.

---

## ⚠️ Riesgos / notas

- El prototipo **no tiene backend**: nada persiste al recargar.
- **Premium y RFID son demostrativos** ("Próximamente"); no hay dispositivos ni cobros reales.
- Privacidad/seguridad ya reflejada en UX (cámaras solo en zonas comunes; la IA sugiere pero un humano confirma incidentes/cargos/accesos): **mantener estos principios** en la implementación real.
- Los docs Atlas desaconsejan sombras decorativas; se añadieron por pedido del cliente combinándolas con borde. Reversible con una variable.

---

## 📊 Referencia de mercado (competencia) — para pricing y roadmap

> Recopilado el 2026-08-06 como benchmarking. **No es nuestra estructura de precios**, es referencia de terceros para posicionar planes y detectar features esperadas. (Nuestro Premium en el prototipo hoy es S/ 89/mes "Próximamente".)

### Planes de SysHotel ([syshotel.app](https://syshotel.app/)) — PMS para hostales (Perú)
Toggle de facturación: **Mensual · Semestral (−10%) · Anual (−25%)**.

| Plan | Precio | Para quién |
|---|---|---|
| **Lite** | **S/ 140/mes** | "Hecho para escalar contigo" |
| **Pro** *(Más popular)* | **S/ 210/mes** | "Mejor experiencia para tus huéspedes" |
| **Enterprise** | **S/ 350/mes** | "Máximo rendimiento en temporadas altas" |

**Plan Lite (S/ 140):** PMS Hotelero (Recepción) · Gestión de habitaciones · Check-in/Check-out · Gestión de huéspedes · Tarifas básicas · Housekeeping básico · Facturación electrónica · Reportes básicos · Hasta 2 usuarios · Soporte por correo.

**Plan Pro (S/ 210):** PMS Hotelero completo · Tarifas por temporada · Consumos a habitación · POS integrado · Gestión de caja · Inventarios · Compras y gastos · Reportes gerenciales · Facturación electrónica + PSE · Hasta 3–5 usuarios · Soporte por WhatsApp.

**Plan Enterprise (S/ 350):** *Incluye TODO el Plan Pro +* Dashboard avanzado · Reportes avanzados · Ventas y reportes por sucursal · Control por centros de costo · Auditoría de ventas · Roles y permisos avanzados · Facturación electrónica + PSE · Integración WhatsApp · Usuarios ilimitados · Soporte prioritario (WhatsApp + correo + llamada) · Multi-sucursal (1 incluida, adicional S/ 60/mes) · Reportes consolidados por sucursal · OTAs adicional: S/ 48/habitación.

### Otros referentes / directorios a revisar
- [okfac.pe/hotel/hostal](https://okfac.pe/hotel/hostal) — PMS + facturación electrónica (Perú).
- [capterra.pe · Hostel Management](https://www.capterra.pe/directory/31457/hostel-management/software) — directorio comparativo de software.
- [hospedajeperu.net](https://www.hospedajeperu.net/) — software de hospedaje (Perú).

### Lectura rápida vs. lo que ya tiene nuestro prototipo
- **Features que ellos cobran y nosotros ya tenemos (en mock):** gestión de habitaciones, check-in/out, huéspedes, **gestión de caja**, **inventarios**, **compras/gastos** (movimientos), reportes, **roles y permisos**, **integración WhatsApp** (recuperación), tarifas por tipo/temporada.
- **Gaps a considerar para el MVP con backend:** facturación electrónica + PSE (SUNAT), POS integrado, multi-sucursal / centros de costo, integración con OTAs (Booking/Expedia), consumos a habitación reales, reportes gerenciales.
- **Nuestros valores agregados (diferenciadores frente a estos PMS):** IA como **núcleo operativo** (agente conversacional por voz/entidades, no un chatbot añadido), **sugerencia de cuarto** por características/aforo, **cierre de turno con doble conteo + incidencias justificadas**, **cierre de caja asistido por IA** con multimoneda y resumen por correo, y **seguridad** (RFID/cámaras/sensores) como línea Premium.

> Nota: precios y features transcritos de material público de terceros, con fines de referencia. Verificar antes de usarlos en una comparación formal.
