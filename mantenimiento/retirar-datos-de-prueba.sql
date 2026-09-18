-- Retira del sistema todo lo marcado como prueba.
--
-- Cuándo se usa: una sola vez, cuando el padrón real ya esté cargado y
-- verificado. A partir de ese momento el aviso de «sitio en desarrollo» se
-- apaga solo, sin tocar código: el portal lo enciende únicamente mientras
-- exista al menos un registro con es_ficticio = 1.
--
-- El orden importa. Las solicitudes se borran primero porque su llave hacia el
-- ejemplar está declarada ON DELETE SET NULL: si se borrara el ejemplar antes,
-- las solicitudes de prueba quedarían huérfanas en la base en lugar de
-- desaparecer. Las fotografías sí caerían solas por cascada, pero se borran a
-- mano para que la sentencia diga lo que hace.
--
-- ANTES DE EJECUTAR: respaldar la base.
--   npx wrangler d1 export amar-es-adoptar --remote --output respaldo-previo.sql

DELETE FROM solicitud WHERE es_ficticio = 1;

DELETE FROM fotografia
 WHERE ejemplar_id IN (SELECT id FROM ejemplar WHERE es_ficticio = 1);

DELETE FROM ejemplar WHERE es_ficticio = 1;

-- Comprobación: las tres cuentas deben quedar en cero.
SELECT (SELECT COUNT(*) FROM ejemplar  WHERE es_ficticio = 1) AS ejemplares_de_prueba,
       (SELECT COUNT(*) FROM solicitud WHERE es_ficticio = 1) AS solicitudes_de_prueba,
       (SELECT COUNT(*) FROM fotografia f
          LEFT JOIN ejemplar e ON e.id = f.ejemplar_id
         WHERE e.id IS NULL) AS fotografias_huerfanas;
