-- ---------------------------------------------------------------------------
-- 0008 — Retira los ejemplares ficticios en semáforo amarillo
--
-- POR QUÉ
-- Al programa sólo ingresan ejemplares en VERDE, y un ejemplar en amarillo
-- tampoco se publica. Los datos ficticios traían siete en amarillo, que se
-- habían creado justamente para probar que el catálogo representara todos los
-- valores. Esa razón dejó de existir: hoy un amarillo en el catálogo sería un
-- registro que nadie puede ver y que nadie sabría por qué está ahí.
--
-- QUÉ HACE
--   1. Repunta la única solicitud ficticia que apuntaba a uno de ellos
--      (Mapache) hacia Güero, para no perder el estado APROBADA de las
--      pruebas. Se corrige también su instantánea, que guardaba 'AMARILLO'.
--   2. Borra los siete ejemplares. Sus fotografías se van solas: la llave
--      foránea de `fotografia` es ON DELETE CASCADE.
--
-- SEGURIDAD
-- Todos llevan es_ficticio = 1 y la condición está escrita en el DELETE. Esta
-- migración no puede tocar un registro real ni aunque se corra por error
-- sobre una base con información verdadera.
--
-- Las migraciones 0002 y 0005 ya vienen corregidas, así que una base creada
-- desde cero nunca llega a tener estos registros y aquí no borra nada. Es
-- idempotente: correrla dos veces da el mismo resultado.
-- ---------------------------------------------------------------------------

UPDATE solicitud
   SET ejemplar_id         = (SELECT id FROM ejemplar WHERE slug = 'guero-d652'),
       snap_folio_interno  = '00169',
       snap_semaforo       = 'VERDE',
       snap_nombre         = 'Güero',
       snap_talla          = 'MEDIANO'
 WHERE folio = '2026-000005'
   AND es_ficticio = 1;

DELETE FROM ejemplar
 WHERE es_ficticio = 1
   AND semaforo = 'AMARILLO';
