-- =====================================================================
-- Migración 0002 — datos ficticios de desarrollo
--
-- NO EJECUTAR EN PRODUCCIÓN CON INFORMACIÓN REAL.
--
-- Carga los 30 ejemplares inventados que hoy alimentan el portal, con el
-- mismo contenido del archivo src/datos/ejemplares.json. Sirve para
-- construir y probar la administración antes de que llegue el catálogo
-- verdadero, y para verificar que las restricciones del esquema aceptan
-- datos con la forma real.
--
-- Todos los registros llevan es_ficticio = 1. La migración 0003 los
-- retirará cuando se cargue la información auténtica.
--
--   npx wrangler d1 execute amar-es-adoptar --local  --file=./migraciones/0002_datos_ficticios.sql
--   npx wrangler d1 execute amar-es-adoptar --remote --file=./migraciones/0002_datos_ficticios.sql
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Personal de desarrollo. Los identificadores 'dev-' sólo funcionan con el
-- proveedor de identidad simulado; con Llave CDMX no autentican nada.
INSERT INTO usuario (oidc_sub, nombre, correo, rol, centro_clave) VALUES
  ('dev-admin',    'Administración SEDEMA (desarrollo)', 'desarrollo@ejemplo.local', 'ADMIN_GLOBAL', NULL),
  ('dev-bva',      'Capturista BVA (desarrollo)',        'desarrollo@ejemplo.local', 'CAPTURISTA',   'BVA'),
  ('dev-ajusco',   'Capturista Ajusco (desarrollo)',     'desarrollo@ejemplo.local', 'CAPTURISTA',   'AJUSCO'),
  ('dev-galeana',  'Capturista Galeana (desarrollo)',    'desarrollo@ejemplo.local', 'CAPTURISTA',   'GALEANA');


-- Ejemplares --------------------------------------------------------

INSERT INTO ejemplar (id, slug, centro_origen_clave, folio_interno, centro_actual_clave,
                      nombre, edad_clave, sexo_clave, talla_clave, semaforo, condicion, es_ficticio) VALUES
  (1, 'canela-5279', 'AJUSCO', '00120', 'AJUSCO', 'Canela', 'ADULTO', 'HEMBRA', 'MEDIANO', 'VERDE', 'DISPONIBLE', 1),
  (2, 'frijol-1f1d', 'BVA', '00120', 'BVA', 'Frijol', 'JOVEN', 'MACHO', 'CHICO', 'VERDE', 'DISPONIBLE', 1),
  (3, 'nube-3fc6', 'GALEANA', '00120', 'GALEANA', 'Nube', 'JOVEN', 'HEMBRA', 'MEDIANO', 'VERDE', 'DISPONIBLE', 1),
  (4, 'mapache-3da4', 'AJUSCO', '00127', 'AJUSCO', 'Mapache', 'ADULTO', 'MACHO', 'GRANDE', 'AMARILLO', 'DISPONIBLE', 1),
  (5, 'chabela-40a5', 'BVA', '00127', 'BVA', 'Chabela', 'GERIATRA', 'HEMBRA', 'CHICO', 'VERDE', 'DISPONIBLE', 1),
  (6, 'ojon-5c8d', 'GALEANA', '00127', 'GALEANA', 'Ojón', 'ADULTO', 'MACHO', 'GRANDE', 'VERDE', 'DISPONIBLE', 1),
  (7, 'blanca-da04', 'AJUSCO', '00134', 'AJUSCO', 'Blanca', 'ADULTO', 'HEMBRA', 'MEDIANO', 'VERDE', 'EN_PROCESO', 1),
  (8, 'orion-7427', 'BVA', '00134', 'BVA', 'Orión', 'GERIATRA', 'MACHO', 'GRANDE', 'AMARILLO', 'DISPONIBLE', 1),
  (9, 'cejitas-6231', 'GALEANA', '00134', 'GALEANA', 'Cejitas', 'JOVEN', 'MACHO', 'MEDIANO', 'VERDE', 'DISPONIBLE', 1),
  (10, 'moka-9388', 'AJUSCO', '00141', 'GALEANA', 'Moka', 'ADULTO', 'HEMBRA', 'MEDIANO', 'VERDE', 'DISPONIBLE', 1),
  (11, 'tostada-b456', 'BVA', '00141', 'BVA', 'Tostada', 'JOVEN', 'HEMBRA', 'CHICO', 'VERDE', 'DISPONIBLE', 1),
  (12, 'bigotes-df39', 'GALEANA', '00141', 'GALEANA', 'Bigotes', 'GERIATRA', 'MACHO', 'MEDIANO', 'AMARILLO', 'DISPONIBLE', 1),
  (13, 'pinto-778d', 'AJUSCO', '00148', 'AJUSCO', 'Pinto', 'ADULTO', 'MACHO', 'GRANDE', 'VERDE', 'ADOPTADO', 1),
  (14, 'luna-4eb7', 'BVA', '00148', 'BVA', 'Luna', 'JOVEN', 'HEMBRA', 'GRANDE', 'VERDE', 'DISPONIBLE', 1),
  (15, 'chamoy-e031', 'GALEANA', '00148', 'GALEANA', 'Chamoy', 'ADULTO', 'MACHO', 'CHICO', 'VERDE', 'DISPONIBLE', 1),
  (16, 'pecas-1ac3', 'AJUSCO', '00155', 'AJUSCO', 'Pecas', 'ADULTO', 'HEMBRA', 'MEDIANO', 'AMARILLO', 'DISPONIBLE', 1),
  (17, 'rufo-7080', 'BVA', '00155', 'BVA', 'Rufo', 'GERIATRA', 'MACHO', 'GRANDE', 'VERDE', 'DISPONIBLE', 1),
  (18, 'milanesa-e0a0', 'GALEANA', '00155', 'GALEANA', 'Milanesa', 'JOVEN', 'HEMBRA', 'MEDIANO', 'VERDE', 'DISPONIBLE', 1),
  (19, 'tlacuache-ec22', 'AJUSCO', '00162', 'AJUSCO', 'Tlacuache', 'ADULTO', 'MACHO', 'CHICO', 'AMARILLO', 'EN_PROCESO', 1),
  (20, 'nieve-f43f', 'BVA', '00162', 'GALEANA', 'Nieve', 'GERIATRA', 'HEMBRA', 'MEDIANO', 'VERDE', 'DISPONIBLE', 1),
  (21, 'bartolo-a8a6', 'GALEANA', '00162', 'GALEANA', 'Bartolo', 'JOVEN', 'MACHO', 'GRANDE', 'VERDE', 'DISPONIBLE', 1),
  (22, 'canela-8b22', 'BVA', '00169', 'BVA', 'Canela', 'JOVEN', 'HEMBRA', 'CHICO', 'VERDE', 'DISPONIBLE', 1),
  (23, 'guero-d652', 'AJUSCO', '00169', 'AJUSCO', 'Güero', 'ADULTO', 'MACHO', 'MEDIANO', 'VERDE', 'DISPONIBLE', 1),
  (24, 'pambazo-a64a', 'GALEANA', '00169', 'GALEANA', 'Pambazo', 'GERIATRA', 'MACHO', 'CHICO', 'AMARILLO', 'DISPONIBLE', 1),
  (25, 'chispa-6976', 'BVA', '00176', 'BVA', 'Chispa', 'JOVEN', 'HEMBRA', 'CHICO', 'VERDE', 'DISPONIBLE', 1),
  (26, 'coco-bfea', 'AJUSCO', '00176', 'AJUSCO', 'Coco', 'ADULTO', 'MACHO', 'MEDIANO', 'VERDE', 'ADOPTADO', 1),
  (27, 'manchas-fd4a', 'GALEANA', '00176', 'GALEANA', 'Manchas', 'JOVEN', 'MACHO', 'GRANDE', 'VERDE', 'DISPONIBLE', 1),
  (28, 'luna-b9d4', 'AJUSCO', '00183', 'AJUSCO', 'Luna', 'GERIATRA', 'HEMBRA', 'CHICO', 'AMARILLO', 'DISPONIBLE', 1),
  (29, 'emperatriz-de-la-colonia-doctores-dff9', 'BVA', '00183', 'BVA', 'Emperatriz de la Colonia Doctores', 'ADULTO', 'HEMBRA', 'GRANDE', 'VERDE', 'EN_PROCESO', 1),
  (30, 'tuna-1e3c', 'GALEANA', '00183', 'GALEANA', 'Tuna', 'ADULTO', 'HEMBRA', 'CHICO', 'VERDE', 'DISPONIBLE', 1);


-- Fotografías de muestra --------------------------------------------
-- Apuntan a los archivos que ya viven en public/imagenes/muestra/.
-- Cuando exista R2, las rutas reales las escribirá el módulo de carga.

INSERT INTO fotografia (ejemplar_id, orden, clave_original, clave_ficha,
                        clave_tarjeta, clave_miniatura, texto_alternativo) VALUES
  (1, 1, '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', 'Fotografía de muestra del ser sintiente llamado Canela'),
  (1, 2, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Canela'),
  (1, 3, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Canela'),
  (2, 1, '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', 'Fotografía de muestra del ser sintiente llamado Frijol'),
  (2, 2, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Frijol'),
  (3, 1, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Nube'),
  (3, 2, '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', 'Fotografía de muestra del ser sintiente llamado Nube'),
  (3, 3, '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', 'Fotografía de muestra del ser sintiente llamado Nube'),
  (4, 1, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Mapache'),
  (5, 1, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Chabela'),
  (5, 2, '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', 'Fotografía de muestra del ser sintiente llamado Chabela'),
  (6, 1, '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', 'Fotografía de muestra del ser sintiente llamado Ojón'),
  (6, 2, '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', 'Fotografía de muestra del ser sintiente llamado Ojón'),
  (6, 3, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Ojón'),
  (7, 1, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Blanca'),
  (7, 2, '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', 'Fotografía de muestra del ser sintiente llamado Blanca'),
  (8, 1, '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', 'Fotografía de muestra del ser sintiente llamado Orión'),
  (9, 1, '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', 'Fotografía de muestra del ser sintiente llamado Cejitas'),
  (9, 2, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Cejitas'),
  (9, 3, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Cejitas'),
  (10, 1, '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', 'Fotografía de muestra del ser sintiente llamado Moka'),
  (10, 2, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Moka'),
  (11, 1, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Tostada'),
  (12, 1, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Bigotes'),
  (12, 2, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Bigotes'),
  (13, 1, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Pinto'),
  (13, 2, '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', 'Fotografía de muestra del ser sintiente llamado Pinto'),
  (13, 3, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Pinto'),
  (14, 1, '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', 'Fotografía de muestra del ser sintiente llamado Luna'),
  (14, 2, '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', 'Fotografía de muestra del ser sintiente llamado Luna'),
  (15, 1, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Chamoy'),
  (16, 1, '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', 'Fotografía de muestra del ser sintiente llamado Pecas'),
  (16, 2, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Pecas'),
  (16, 3, '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', 'Fotografía de muestra del ser sintiente llamado Pecas'),
  (18, 1, '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', 'Fotografía de muestra del ser sintiente llamado Milanesa'),
  (18, 2, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Milanesa'),
  (19, 1, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Tlacuache'),
  (20, 1, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Nieve'),
  (20, 2, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Nieve'),
  (20, 3, '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', 'Fotografía de muestra del ser sintiente llamado Nieve'),
  (21, 1, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Bartolo'),
  (21, 2, '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', 'Fotografía de muestra del ser sintiente llamado Bartolo'),
  (22, 1, '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', 'Fotografía de muestra del ser sintiente llamado Canela'),
  (23, 1, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Güero'),
  (23, 2, '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', 'Fotografía de muestra del ser sintiente llamado Güero'),
  (23, 3, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Güero'),
  (24, 1, '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', 'Fotografía de muestra del ser sintiente llamado Pambazo'),
  (24, 2, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Pambazo'),
  (25, 1, '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', 'Fotografía de muestra del ser sintiente llamado Chispa'),
  (25, 2, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Chispa'),
  (25, 3, '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', '/imagenes/muestra/muestra-07.svg', 'Fotografía de muestra del ser sintiente llamado Chispa'),
  (26, 1, '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', '/imagenes/muestra/muestra-08.svg', 'Fotografía de muestra del ser sintiente llamado Coco'),
  (27, 1, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Manchas'),
  (27, 2, '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', 'Fotografía de muestra del ser sintiente llamado Manchas'),
  (28, 1, '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', '/imagenes/muestra/muestra-06.svg', 'Fotografía de muestra del ser sintiente llamado Luna'),
  (29, 1, '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', '/imagenes/muestra/muestra-01.svg', 'Fotografía de muestra del ser sintiente llamado Emperatriz de la Colonia Doctores'),
  (29, 2, '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', '/imagenes/muestra/muestra-02.svg', 'Fotografía de muestra del ser sintiente llamado Emperatriz de la Colonia Doctores'),
  (29, 3, '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', '/imagenes/muestra/muestra-03.svg', 'Fotografía de muestra del ser sintiente llamado Emperatriz de la Colonia Doctores'),
  (30, 1, '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', '/imagenes/muestra/muestra-04.svg', 'Fotografía de muestra del ser sintiente llamado Tuna'),
  (30, 2, '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', '/imagenes/muestra/muestra-05.svg', 'Fotografía de muestra del ser sintiente llamado Tuna');


-- Comprobación: debe devolver 30 ejemplares, todos ficticios.
SELECT COUNT(*) AS ejemplares, SUM(es_ficticio) AS ficticios FROM ejemplar;
