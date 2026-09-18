-- ---------------------------------------------------------------------------
-- 0011 — Fechas de ingreso escalonadas, y en un solo formato
--
-- QUÉ ARREGLA
--
-- 1. UN CAMBIO DE DATOS QUE NUNCA SE ASENTÓ
--    En la base local, cinco ejemplares ficticios tenían `creado_en` en julio
--    de 2025 y enero de 2026. Nadie los creó entonces: se corrió un UPDATE
--    suelto —con `d1 execute --command`— para escalonar las fechas y poder
--    probar la insignia «Lleva N meses esperando» de la ficha pública.
--
--    Ese cambio no quedó en ninguna migración, así que existía SÓLO en la
--    máquina donde se ejecutó. La base remota seguía con las fechas
--    originales. Las dos bases daban los mismos cuatro números de estructura
--    —11 tablas, 133 columnas, 10 índices, 10 migraciones— y aun así tenían
--    datos distintos.
--
-- 2. DOS FORMATOS EN LA MISMA COLUMNA
--    El UPDATE usó `datetime()` de SQLite, que devuelve «2025-07-17 19:03:53»;
--    la aplicación escribe «2026-09-16T00:17:25Z». La ordenación aguanta
--    —la parte de la fecha va primero— pero el navegador interpreta el primero
--    como hora local y el segundo como UTC, así que el mismo instante se lee
--    con seis horas de diferencia según de dónde salió el renglón.
--
-- QUÉ HACE
--
-- Primero normaliza el formato de todo lo que no lo tenga, y después reparte
-- las fechas de los ejemplares FICTICIOS de forma reproducible, para que
-- cualquier base —local, remota o una recién creada— acabe igual y siga
-- habiendo casos de cada tramo de la insignia de espera:
--
--   más de dos años · más de un año · más de seis meses · reciente · de hoy
--
-- SEGURIDAD
-- El reparto sólo toca renglones con es_ficticio = 1. Un ejemplar real
-- conserva la fecha en que se capturó, que es un dato y no un adorno.
-- ---------------------------------------------------------------------------

-- 1. Un solo formato: ISO con T y Z, el que escribe la aplicación.
UPDATE ejemplar
   SET creado_en = strftime('%Y-%m-%dT%H:%M:%SZ', creado_en)
 WHERE creado_en NOT LIKE '%T%Z';

UPDATE ejemplar
   SET actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', actualizado_en)
 WHERE actualizado_en IS NOT NULL
   AND actualizado_en NOT LIKE '%T%Z';

-- 2. Reparto reproducible de las fechas de prueba.
--    El tramo sale del id, así que dos bases con los mismos ejemplares
--    ficticios quedan idénticas, y correr esto dos veces da el mismo
--    resultado sólo si se corre el mismo día: es dato de prueba, no de
--    operación, y esa aproximación basta.
UPDATE ejemplar
   SET creado_en = strftime(
         '%Y-%m-%dT%H:%M:%SZ',
         datetime('now', '-' || (CASE id % 5
                                   WHEN 0 THEN 26
                                   WHEN 1 THEN 14
                                   WHEN 2 THEN 8
                                   WHEN 3 THEN 3
                                   ELSE 0
                                 END) || ' months')
       )
 WHERE es_ficticio = 1;
