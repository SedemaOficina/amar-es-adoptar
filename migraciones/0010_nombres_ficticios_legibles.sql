-- ---------------------------------------------------------------------------
-- 0010 — Nombres legibles en las solicitudes ficticias
--
-- POR QUÉ
-- Las seis solicitudes de prueba decían «PERSONA DE PRUEBA DOS APELLIDO-PRUEBA
-- APELLIDO-PRUEBA». Cumplía la regla del proyecto —nada que parezca una persona
-- real (D-112)— pero en la pantalla de Indicadores esos nombres aparecen en una
-- lista de personas que esperan respuesta, y ahí se leían como un error del
-- sistema, no como un dato de prueba.
--
-- Se alinean con las DOS IDENTIDADES SIMULADAS con las que se entra al portal
-- en desarrollo, que ya llevaban nombres legibles e inequívocamente falsos:
--   dev-ciudadania-1 → Fulana de Tal Mengano
--   dev-ciudadania-2 → Zutano de Tal
--
-- Así la solicitud y quien la envió dicen lo mismo, que antes tampoco pasaba.
--
-- SEGURIDAD
-- Sólo toca renglones con es_ficticio = 1. No puede alcanzar una solicitud
-- real ni aunque se corra por error sobre una base con información verdadera.
--
-- La migración 0005 ya viene corregida, así que una base creada desde cero
-- nunca llega a tener los nombres viejos y aquí no cambia nada. Es idempotente.
-- ---------------------------------------------------------------------------

UPDATE solicitud
   SET nombres            = 'Fulana',
       primer_apellido    = 'de Tal',
       segundo_apellido   = 'Mengano',
       correo_electronico = 'fulana-de-tal@ejemplo.local'
 WHERE es_ficticio = 1
   AND llave_sub = 'dev-ciudadania-1';

UPDATE solicitud
   SET nombres            = 'Zutano',
       primer_apellido    = 'de Tal',
       segundo_apellido   = '',
       correo_electronico = 'zutano-de-tal@ejemplo.local'
 WHERE es_ficticio = 1
   AND llave_sub = 'dev-ciudadania-2';
