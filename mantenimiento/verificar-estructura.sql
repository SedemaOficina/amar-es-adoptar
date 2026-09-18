-- COMPROBACIÓN DE ESTRUCTURA. Se puede correr cuantas veces se quiera: sólo
-- lee, no escribe nada.
--
-- PARA QUÉ SIRVE
-- Responde a una pregunta: ¿esta base tiene la estructura que le corresponde?
-- Se usa después de aplicar migraciones, antes de una entrega, y siempre que
-- haya duda de si dos bases están igual.
--
-- POR QUÉ CUENTA TODO Y NO UNA COSA
-- El 17 de septiembre de 2026 se comprobó si la migración 0004 estaba
-- aplicada en la base remota buscando la columna `solicitud.estado`. La
-- encontró y se dio por aplicada. Estaba equivocado: esa columna existe desde
-- la 0001; lo que agrega la 0004 son `estado_en` y `estado_por`. Se registró
-- como aplicada una migración que no lo estaba, y la siguiente falló.
--
-- La lección: UNA MIGRACIÓN NO SE VERIFICA POR UNA COLUMNA. Se verifica
-- comparando el conjunto completo contra una referencia conocida.
--
-- VALORES ESPERADOS al 17 de septiembre de 2026, con las migraciones 0001 a
-- 0011 aplicadas:
--
--   tablas       11
--   columnas    133
--   indices      10
--   migraciones  11
--
-- Los índices pasaron de 4 a 10 con la migración 0009, que repuso los seis que
-- la 0006 se había llevado al rehacer tres tablas sin volver a crearlos. Si
-- una base reporta 4, le falta la 0009.
--
-- Cualquier número distinto significa que las dos bases NO están iguales.
-- Por ejemplo: 129 columnas = faltan las cuatro de baja (0006);
--              131 columnas = faltan `estado_en` y `estado_por` (0004).
--
-- AL AGREGAR UNA MIGRACIÓN que cambie la estructura hay que actualizar estos
-- números y la lista de tablas de abajo. Si no, esta comprobación deja de
-- servir y, peor, dice que algo está mal cuando está bien.

SELECT
  (SELECT COUNT(*) FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '_cf_%')                          AS tablas,

  -- La suma de columnas de las once tablas. No hay forma de recorrerlas en
  -- una sola consulta de SQLite, así que se enumeran.
  (SELECT COUNT(*) FROM pragma_table_info('bitacora'))
  + (SELECT COUNT(*) FROM pragma_table_info('centro'))
  + (SELECT COUNT(*) FROM pragma_table_info('d1_migrations'))
  + (SELECT COUNT(*) FROM pragma_table_info('edad'))
  + (SELECT COUNT(*) FROM pragma_table_info('ejemplar'))
  + (SELECT COUNT(*) FROM pragma_table_info('fotografia'))
  + (SELECT COUNT(*) FROM pragma_table_info('importacion'))
  + (SELECT COUNT(*) FROM pragma_table_info('sexo'))
  + (SELECT COUNT(*) FROM pragma_table_info('solicitud'))
  + (SELECT COUNT(*) FROM pragma_table_info('talla'))
  + (SELECT COUNT(*) FROM pragma_table_info('usuario'))     AS columnas,

  (SELECT COUNT(*) FROM sqlite_master
     WHERE type = 'index' AND name NOT LIKE 'sqlite_%')     AS indices,

  (SELECT COUNT(*) FROM d1_migrations)                      AS migraciones;
