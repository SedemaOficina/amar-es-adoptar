-- ---------------------------------------------------------------------------
-- 0005 — Solicitudes ficticias para probar filtros, estados y orden
--
-- SEIS solicitudes repartidas entre los tres centros y entre cinco estados
-- distintos, con antigüedades de 1 a 35 días. Sin ellas es imposible saber si
-- un filtro devuelve vacío porque funciona o porque está roto.
--
-- TODO en ellas es inequívocamente falso, conforme a la regla del proyecto
-- (D-112): las personas son «Fulana de Tal Mengano» y «Zutano de Tal» —las
-- mismas dos identidades simuladas con las que se entra al portal en
-- desarrollo—, la CURP no tiene forma de CURP, los teléfonos son ceros y el
-- dominio del correo es .local, que no existe en internet. Van marcadas con
-- es_ficticio = 1.
--
-- Antes decían «PERSONA DE PRUEBA DOS APELLIDO-PRUEBA», que es inequívoco pero
-- ilegible: en la pantalla de indicadores esos nombres salen en una lista de
-- personas y se leían como un error del sistema, no como un dato de prueba.
--
-- SE RETIRAN antes de cargar información real:
--   DELETE FROM solicitud WHERE es_ficticio = 1;
-- ---------------------------------------------------------------------------

INSERT INTO solicitud
  (folio, es_ficticio, ejemplar_id, recibida_en, estado,
   snap_folio_interno, snap_centro_origen, snap_centro_actual, snap_semaforo,
   snap_nombre, snap_edad, snap_sexo, snap_talla, snap_condicion,
   llave_sub, nombres, primer_apellido, segundo_apellido, curp,
   calle, numero_exterior, numero_interior, codigo_postal, alcaldia, colonia,
   telefono_celular, correo_electronico,
   p1, p2_a, p2_b, p2_c, p2_d, p2_e, p2_f, p2_g,
   p3, p4, p5, p6, p7,
   p8_a, p8_b, p8_c, p8_d, p8_e, p8_f, p8_g, p9)
VALUES
  ('2026-000002', 1, 2, datetime('now', '-1 days'), 'RECIBIDA', '00120', 'BVA', 'BVA', 'VERDE', 'Frijol', 'JOVEN', 'MACHO', 'CHICO', 'DISPONIBLE', 'dev-ciudadania-2', 'Zutano', 'de Tal', '', 'CURP-DE-PRUEBA-02', 'CALLE DE PRUEBA', '2', '', '00000', 'ALCALDÍA DE PRUEBA', 'COLONIA DE PRUEBA', '5500000002', 'zutano-de-tal@ejemplo.local', 'C', 1, 1, 0, 0, 1, 0, 0, 'B', 'D', 'A', 'A', 'E', 1, 0, 0, 0, 0, 0, 0, 'B'),
  ('2026-000003', 1, 5, datetime('now', '-4 days'), 'RECIBIDA', '00127', 'BVA', 'BVA', 'VERDE', 'Chabela', 'GERIATRA', 'HEMBRA', 'CHICO', 'DISPONIBLE', 'dev-ciudadania-1', 'Fulana', 'de Tal', 'Mengano', 'CURP-DE-PRUEBA-03', 'CALLE DE PRUEBA', '3', '', '00000', 'ALCALDÍA DE PRUEBA', 'COLONIA DE PRUEBA', '5500000003', 'fulana-de-tal@ejemplo.local', 'D', 0, 0, 0, 0, 1, 0, 0, 'D', 'A', 'B', 'A', 'E', 0, 1, 0, 0, 0, 0, 0, 'G'),
  ('2026-000004', 1, 1, datetime('now', '-9 days'), 'CONTACTADA', '00120', 'AJUSCO', 'AJUSCO', 'VERDE', 'Canelatttt', 'ADULTO', 'HEMBRA', 'MEDIANO', 'DISPONIBLE', 'dev-ciudadania-2', 'Zutano', 'de Tal', '', 'CURP-DE-PRUEBA-04', 'CALLE DE PRUEBA', '4', '', '00000', 'ALCALDÍA DE PRUEBA', 'COLONIA DE PRUEBA', '5500000004', 'zutano-de-tal@ejemplo.local', 'A', 1, 1, 0, 1, 0, 0, 0, 'D', 'A', 'B', 'A', 'E', 1, 1, 0, 0, 1, 0, 0, 'C'),
  ('2026-000005', 1, 23, datetime('now', '-16 days'), 'APROBADA', '00169', 'AJUSCO', 'AJUSCO', 'VERDE', 'Güero', 'ADULTO', 'MACHO', 'MEDIANO', 'DISPONIBLE', 'dev-ciudadania-1', 'Fulana', 'de Tal', 'Mengano', 'CURP-DE-PRUEBA-05', 'CALLE DE PRUEBA', '5', '', '00000', 'ALCALDÍA DE PRUEBA', 'COLONIA DE PRUEBA', '5500000005', 'fulana-de-tal@ejemplo.local', 'B', 0, 0, 0, 1, 1, 0, 0, 'C', 'A', 'E', 'A', 'E', 0, 1, 1, 1, 1, 0, 0, 'A'),
  ('2026-000006', 1, 3, datetime('now', '-23 days'), 'RECHAZADA', '00120', 'GALEANA', 'GALEANA', 'VERDE', 'Nube', 'JOVEN', 'HEMBRA', 'MEDIANO', 'DISPONIBLE', 'dev-ciudadania-2', 'Zutano', 'de Tal', '', 'CURP-DE-PRUEBA-06', 'CALLE DE PRUEBA', '6', '', '00000', 'ALCALDÍA DE PRUEBA', 'COLONIA DE PRUEBA', '5500000006', 'zutano-de-tal@ejemplo.local', 'C', 0, 0, 1, 1, 1, 1, 0, 'B', 'B', 'B', 'A', 'E', 1, 0, 0, 0, 0, 0, 0, 'E'),
  ('2026-000007', 1, 6, datetime('now', '-35 days'), 'CONCLUIDA', '00127', 'GALEANA', 'GALEANA', 'VERDE', 'Ojón', 'ADULTO', 'MACHO', 'GRANDE', 'DISPONIBLE', 'dev-ciudadania-1', 'Fulana', 'de Tal', 'Mengano', 'CURP-DE-PRUEBA-07', 'CALLE DE PRUEBA', '7', '', '00000', 'ALCALDÍA DE PRUEBA', 'COLONIA DE PRUEBA', '5500000007', 'fulana-de-tal@ejemplo.local', 'D', 0, 0, 0, 0, 1, 0, 0, 'B', 'C', 'B', 'D', 'D', 0, 0, 1, 1, 0, 1, 0, 'A');
