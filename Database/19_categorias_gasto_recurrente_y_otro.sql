-- #############################################################################
-- 19_categorias_gasto_recurrente_y_otro.sql · Hostal Inteligente (Atlas)
--
-- Separa lo que hasta ahora era un solo "justificable" en dos categorías que pidió
-- el hostal: `recurrente` (gas, un plomero, escobas — no está en el catálogo pero se
-- repite) y `otro` (lo que no se espera: un pinchazo, algo puntual). Las dos siguen
-- exigiendo justificación y disparando alerta — eso no cambia, solo se separan para
-- poder distinguirlas en Caja y en los reportes.
--
-- Solo agrega los valores al enum. A propósito en su propio archivo: Postgres no deja
-- usar un valor de enum recién agregado en la MISMA transacción que lo agrega, y cada
-- migración de este proyecto corre en la suya. `20_gastos_tres_categorias.sql` ya los usa.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

alter type public.categoria_gasto add value if not exists 'recurrente';
alter type public.categoria_gasto add value if not exists 'otro';
