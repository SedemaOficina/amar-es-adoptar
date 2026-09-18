-- Marca como ficticio TODO lo que hay en la base en este momento.
--
-- Cuándo se usa: mientras el sistema está en desarrollo y todavía no entra
-- un solo dato real. Sirve para que la bandera `es_ficticio` diga la verdad,
-- porque de ella dependen dos cosas: el aviso de «sitio en desarrollo» que el
-- portal enciende solo, y el retiro limpio de las pruebas más adelante.
--
-- Un registro capturado a mano desde la administración nace con es_ficticio = 0,
-- porque el sistema no tiene forma de saber que era una prueba. Esta sentencia
-- lo corrige.
--
-- ADVERTENCIA: no ejecutar esto después de cargar el padrón real. Marcaría los
-- registros verdaderos como pruebas y el siguiente retiro los borraría.

UPDATE ejemplar  SET es_ficticio = 1 WHERE es_ficticio = 0;
UPDATE solicitud SET es_ficticio = 1 WHERE es_ficticio = 0;

-- Comprobación: las dos cuentas deben quedar en cero.
SELECT (SELECT COUNT(*) FROM ejemplar  WHERE es_ficticio = 0) AS ejemplares_sin_marcar,
       (SELECT COUNT(*) FROM solicitud WHERE es_ficticio = 0) AS solicitudes_sin_marcar;
