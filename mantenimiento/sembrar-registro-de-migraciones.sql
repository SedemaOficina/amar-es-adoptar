-- SIEMBRA DEL REGISTRO DE MIGRACIONES — se corre UNA SOLA VEZ por base.
--
-- POR QUÉ EXISTE ESTE ARCHIVO
-- Las migraciones 0001 a 0007 se aplicaron a mano con `wrangler d1 execute`,
-- cuando el proyecto todavía no llevaba registro de cuáles se habían corrido.
-- A partir de ahora las aplica `wrangler d1 migrations apply`, que sí lleva
-- la cuenta en la tabla `d1_migrations`.
--
-- El problema es que esa tabla está vacía, así que Wrangler creería que no se
-- ha aplicado ninguna y volvería a correr las siete. La 0006 DESTRUYE Y
-- RECONSTRUYE tres tablas: correrla otra vez sobre datos reales es pérdida de
-- información.
--
-- Este archivo anota las siete como aplicadas SIN ejecutarlas. Después de
-- correrlo, `wrangler d1 migrations list` debe decir que no hay pendientes.
--
-- NO se ejecuta en una base nueva y vacía. Ahí se corre directamente
-- `wrangler d1 migrations apply`, que las aplica todas en orden. Ver
-- DESPLIEGUE.md.
--
-- ---------------------------------------------------------------------------
-- LO QUE PASÓ AL USARLO, Y QUE HAY QUE NO REPETIR
--
-- Este archivo se sembró tal cual en la base LOCAL y funcionó, porque ahí las
-- siete estaban puestas de verdad.
--
-- En la base REMOTA no. Sólo estaban las 0001 a 0003: faltaban la 0004, la
-- 0006 y la 0007. Se creyó que la 0004 estaba aplicada porque se comprobó
-- buscando la columna `solicitud.estado`, que existe desde la 0001; lo que
-- agrega la 0004 son `estado_en` y `estado_por`. Se sembró como aplicada una
-- migración que no lo estaba, la 0006 falló al no encontrar `estado_en`, y
-- hubo que borrar a mano el renglón falso del registro y volver a aplicar.
--
-- Salió bien porque no había datos reales. Con el padrón cargado, la misma
-- secuencia habría dejado la base incompleta con un registro diciendo que
-- estaba al día: el peor de los dos errores, porque es silencioso.
--
-- REGLA: antes de sembrar, comprobar con
-- `mantenimiento/verificar-estructura.sql` y anotar ÚNICAMENTE las
-- migraciones cuya huella completa esté presente. Una columna suelta no es
-- prueba de nada.
-- ---------------------------------------------------------------------------

-- La estructura es la que crea Wrangler: tiene que coincidir exactamente,
-- porque la tabla la va a leer y escribir él, no nosotros.
CREATE TABLE IF NOT EXISTS d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- El nombre es el del archivo, tal cual. Así las compara Wrangler.
-- `OR IGNORE` para que volver a correr esto por error no rompa nada.
INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0001_inicial.sql'),
  ('0002_datos_ficticios.sql'),
  ('0003_orden_fotografias.sql'),
  ('0004_solicitud_estado.sql'),
  ('0005_solicitudes_ficticias.sql'),
  ('0006_baja_de_ejemplares.sql'),
  ('0007_personal.sql');

-- Comprobación: deben salir 7.
SELECT COUNT(*) AS migraciones_registradas FROM d1_migrations;
