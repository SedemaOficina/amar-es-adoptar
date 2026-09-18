-- ---------------------------------------------------------------------------
-- 0009 — Motivo de baja por cambio conductual
--
-- QUÉ AGREGA
--
-- El valor 'CAMBIO_CONDUCTUAL' a los motivos de baja admitidos. Es la salida
-- del portal para un ejemplar que estaba publicado y dejó de ser apto: la
-- regla del programa es que sólo se publica lo que está en semáforo verde
-- (D-118), y la única forma de retirarlo es la baja, con motivo y nota.
--
-- POR QUÉ UNA MIGRACIÓN COMPLETA POR UN VALOR
--
-- El motivo vive en una restricción CHECK, y SQLite no admite modificar una
-- restricción: la única vía es rehacer la tabla. No se eligió guardar el caso
-- dentro de 'OTRO' —que ya existe y obliga a escribir nota— porque ahí el dato
-- deja de poderse contar, y «cuántos salieron del programa por conducta» es
-- exactamente el indicador que va a pedirse. Un motivo que sólo vive en un
-- texto libre no aparece en ninguna gráfica.
--
-- Se hace AHORA, con datos ficticios en la base, y no después del padrón real.
--
-- POR QUÉ SE REHACEN TRES TABLAS Y NO UNA
--
-- Es el mismo problema que resolvió la migración 0006, y la misma solución.
-- `fotografia` y `solicitud` cuelgan de `ejemplar` con borrado en cascada: al
-- eliminar la tabla vieja, esa cascada se lleva las fotografías y desvincula
-- las solicitudes. D1 no admite `PRAGMA foreign_keys = off`, y
-- `defer_foreign_keys` no sirve, porque el borrado en cascada es una acción y
-- no una comprobación que pueda aplazarse.
--
-- La salida es el orden: se crean las tres tablas nuevas, las hijas apuntando
-- ya a `ejemplar_nuevo`; se copian los datos; se sueltan primero las hijas
-- —que no son madre de nadie y no arrastran nada— y al final la madre, que
-- para entonces ya no tiene quien cuelgue de ella. Al renombrar, SQLite
-- actualiza solo las referencias.
--
-- Las definiciones de las tres tablas se copiaron de 0006 sin más cambio que
-- el CHECK del motivo. Si alguna vez difieren, esta migración deja de ser
-- segura: compárense antes de tocarla.
-- ---------------------------------------------------------------------------

CREATE TABLE ejemplar_nuevo (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                TEXT NOT NULL UNIQUE,

  centro_origen_clave TEXT NOT NULL REFERENCES centro(clave),
  folio_interno       TEXT NOT NULL,
  centro_actual_clave TEXT NOT NULL REFERENCES centro(clave),

  nombre              TEXT NOT NULL,
  edad_clave          TEXT NOT NULL REFERENCES edad(clave),
  sexo_clave          TEXT NOT NULL REFERENCES sexo(clave),
  talla_clave         TEXT NOT NULL REFERENCES talla(clave),
  semaforo            TEXT NOT NULL CHECK (semaforo IN ('VERDE', 'AMARILLO')),

  condicion           TEXT NOT NULL DEFAULT 'DISPONIBLE'
                      CHECK (condicion IN ('DISPONIBLE', 'EN_PROCESO', 'ADOPTADO', 'BAJA')),
  -- Motivo de la baja. Obligatorio cuando la condición es BAJA, prohibido
  -- cuando no lo es: un registro que desaparece del portal sin decir por qué
  -- es una pregunta sin respuesta dentro de seis meses.
  baja_motivo         TEXT
                      CHECK (baja_motivo IS NULL OR baja_motivo IN
                             ('FALLECIMIENTO', 'TRASLADO_EXTERNO', 'DUPLICADO',
                              'CAMBIO_CONDUCTUAL', 'OTRO')),
  baja_nota           TEXT,
  baja_en             TEXT,
  baja_por            INTEGER REFERENCES usuario(id),

  
  
  es_ficticio         INTEGER NOT NULL DEFAULT 0 CHECK (es_ficticio IN (0, 1)),

  creado_en           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  creado_por          INTEGER REFERENCES usuario(id),
  actualizado_por     INTEGER REFERENCES usuario(id),

  
  
  
  CHECK (length(folio_interno) = 5 AND folio_interno GLOB '[0-9][0-9][0-9][0-9][0-9]'),

  UNIQUE (centro_origen_clave, folio_interno)
,

  CHECK ((condicion = 'BAJA' AND baja_motivo IS NOT NULL) OR
         (condicion <> 'BAJA' AND baja_motivo IS NULL))
);

CREATE TABLE fotografia_nueva (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ejemplar_id       INTEGER NOT NULL REFERENCES ejemplar_nuevo(id) ON DELETE CASCADE,
  orden             INTEGER NOT NULL
                      CHECK (orden BETWEEN 1 AND 3 OR orden BETWEEN -3 AND -1),

  clave_original    TEXT NOT NULL,
  clave_ficha       TEXT NOT NULL,
  clave_tarjeta     TEXT NOT NULL,
  clave_miniatura   TEXT NOT NULL,

  texto_alternativo TEXT,
  ancho             INTEGER,
  alto              INTEGER,
  bytes             INTEGER,
  creado_en         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  UNIQUE (ejemplar_id, orden)
);

CREATE TABLE solicitud_nueva (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  
  
  folio               TEXT NOT NULL UNIQUE,
  recibida_en         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  
  
  
  estado              TEXT NOT NULL DEFAULT 'RECIBIDA'
                      CHECK (estado IN ('RECIBIDA', 'EN_REVISION', 'CONTACTADA',
                                        'APROBADA', 'RECHAZADA', 'CONCLUIDA')),
  estado_en           TEXT,
  estado_por          INTEGER REFERENCES usuario(id),
  es_ficticio         INTEGER NOT NULL DEFAULT 0 CHECK (es_ficticio IN (0, 1)),

  
  ejemplar_id         INTEGER REFERENCES ejemplar_nuevo(id) ON DELETE SET NULL,
  snap_folio_interno  TEXT NOT NULL,
  snap_centro_origen  TEXT NOT NULL,
  snap_centro_actual  TEXT NOT NULL,
  snap_semaforo       TEXT NOT NULL,
  snap_nombre         TEXT NOT NULL,
  snap_edad           TEXT NOT NULL,
  snap_sexo           TEXT NOT NULL,
  snap_talla          TEXT NOT NULL,
  snap_condicion      TEXT NOT NULL,

  
  
  
  
  llave_sub           TEXT NOT NULL,
  nombres             TEXT NOT NULL,
  primer_apellido     TEXT NOT NULL,
  segundo_apellido    TEXT,
  curp                TEXT NOT NULL,
  calle               TEXT,
  numero_exterior     TEXT,
  numero_interior     TEXT,
  codigo_postal       TEXT,
  alcaldia            TEXT,
  colonia             TEXT,
  telefono_celular    TEXT,
  correo_electronico  TEXT,

  
  p1   TEXT NOT NULL CHECK (p1 IN ('A','B','C','D')),

  p2_a INTEGER NOT NULL DEFAULT 0 CHECK (p2_a IN (0,1)),
  p2_b INTEGER NOT NULL DEFAULT 0 CHECK (p2_b IN (0,1)),
  p2_c INTEGER NOT NULL DEFAULT 0 CHECK (p2_c IN (0,1)),
  p2_d INTEGER NOT NULL DEFAULT 0 CHECK (p2_d IN (0,1)),
  p2_e INTEGER NOT NULL DEFAULT 0 CHECK (p2_e IN (0,1)),
  p2_f INTEGER NOT NULL DEFAULT 0 CHECK (p2_f IN (0,1)),
  p2_g INTEGER NOT NULL DEFAULT 0 CHECK (p2_g IN (0,1)),

  p3   TEXT NOT NULL CHECK (p3 IN ('A','B','C','D')),
  p4   TEXT NOT NULL CHECK (p4 IN ('A','B','C','D')),
  p5   TEXT NOT NULL CHECK (p5 IN ('A','B','C','D','E')),
  p6   TEXT NOT NULL CHECK (p6 IN ('A','B','C','D')),
  p7   TEXT NOT NULL CHECK (p7 IN ('A','B','C','D','E')),

  p8_a INTEGER NOT NULL DEFAULT 0 CHECK (p8_a IN (0,1)),
  p8_b INTEGER NOT NULL DEFAULT 0 CHECK (p8_b IN (0,1)),
  p8_c INTEGER NOT NULL DEFAULT 0 CHECK (p8_c IN (0,1)),
  p8_d INTEGER NOT NULL DEFAULT 0 CHECK (p8_d IN (0,1)),
  p8_e INTEGER NOT NULL DEFAULT 0 CHECK (p8_e IN (0,1)),
  p8_f INTEGER NOT NULL DEFAULT 0 CHECK (p8_f IN (0,1)),
  p8_g INTEGER NOT NULL DEFAULT 0 CHECK (p8_g IN (0,1)),

  p9   TEXT NOT NULL CHECK (p9 IN ('A','B','C','D','E','F','G','H')),

  
  
  
  
  CHECK (p2_a + p2_b + p2_c + p2_d + p2_e + p2_f + p2_g >= 1),
  CHECK (p2_g = 0 OR (p2_a + p2_b + p2_c + p2_d + p2_e + p2_f) = 0),
  CHECK (p8_a + p8_b + p8_c + p8_d + p8_e + p8_f + p8_g >= 1),
  CHECK (p8_g = 0 OR (p8_a + p8_b + p8_c + p8_d + p8_e + p8_f) = 0)
);


INSERT INTO ejemplar_nuevo
  (id, slug, centro_origen_clave, folio_interno,
   centro_actual_clave, nombre, edad_clave, sexo_clave,
   talla_clave, semaforo, condicion, baja_motivo,
   baja_nota, baja_en, baja_por, es_ficticio,
   creado_en, actualizado_en, creado_por, actualizado_por)
SELECT
   id, slug, centro_origen_clave, folio_interno,
   centro_actual_clave, nombre, edad_clave, sexo_clave,
   talla_clave, semaforo, condicion, baja_motivo,
   baja_nota, baja_en, baja_por, es_ficticio,
   creado_en, actualizado_en, creado_por, actualizado_por
  FROM ejemplar;

INSERT INTO fotografia_nueva
  (id, ejemplar_id, orden, clave_original,
   clave_ficha, clave_tarjeta, clave_miniatura, texto_alternativo,
   ancho, alto, bytes, creado_en)
SELECT
   id, ejemplar_id, orden, clave_original,
   clave_ficha, clave_tarjeta, clave_miniatura, texto_alternativo,
   ancho, alto, bytes, creado_en
  FROM fotografia;

INSERT INTO solicitud_nueva
  (id, folio, recibida_en, estado,
   estado_en, estado_por, es_ficticio, ejemplar_id,
   snap_folio_interno, snap_centro_origen, snap_centro_actual, snap_semaforo,
   snap_nombre, snap_edad, snap_sexo, snap_talla,
   snap_condicion, llave_sub, nombres, primer_apellido,
   segundo_apellido, curp, calle, numero_exterior,
   numero_interior, codigo_postal, alcaldia, colonia,
   telefono_celular, correo_electronico, p1, p2_a,
   p2_b, p2_c, p2_d, p2_e,
   p2_f, p2_g, p3, p4,
   p5, p6, p7, p8_a,
   p8_b, p8_c, p8_d, p8_e,
   p8_f, p8_g, p9)
SELECT
   id, folio, recibida_en, estado,
   estado_en, estado_por, es_ficticio, ejemplar_id,
   snap_folio_interno, snap_centro_origen, snap_centro_actual, snap_semaforo,
   snap_nombre, snap_edad, snap_sexo, snap_talla,
   snap_condicion, llave_sub, nombres, primer_apellido,
   segundo_apellido, curp, calle, numero_exterior,
   numero_interior, codigo_postal, alcaldia, colonia,
   telefono_celular, correo_electronico, p1, p2_a,
   p2_b, p2_c, p2_d, p2_e,
   p2_f, p2_g, p3, p4,
   p5, p6, p7, p8_a,
   p8_b, p8_c, p8_d, p8_e,
   p8_f, p8_g, p9
  FROM solicitud;

-- Primero las hijas: ya no son madre de nadie, así que soltarlas no arrastra
-- nada. La madre al final, cuando ya nadie cuelga de ella.
DROP TABLE fotografia;
DROP TABLE solicitud;
DROP TABLE ejemplar;

ALTER TABLE ejemplar_nuevo   RENAME TO ejemplar;
ALTER TABLE fotografia_nueva RENAME TO fotografia;
ALTER TABLE solicitud_nueva  RENAME TO solicitud;

-- ---------------------------------------------------------------------------
-- ÍNDICES QUE HABÍA QUE RECUPERAR
--
-- Los seis de abajo se crearon en la migración 0001 y desaparecieron en la
-- 0006 sin que nadie lo notara: rehacer una tabla se lleva sus índices, y la
-- 0006 no volvió a crearlos. La base ha seguido funcionando —un índice que
-- falta no da error, sólo obliga a recorrer la tabla entera— y con treinta
-- registros no se siente. Con mil sí.
--
-- Como esta migración vuelve a rehacer las mismas tres tablas, es el momento
-- de reponerlos. `IF NOT EXISTS` por si alguna base los conserva.
--
-- LECCIÓN, para la próxima vez que haya que rehacer una tabla: los índices no
-- viajan con los datos. Hay que copiarlos a mano, igual que las columnas.
-- ---------------------------------------------------------------------------

-- Consulta del catálogo público: siempre filtra por condición y ordena.
CREATE INDEX IF NOT EXISTS idx_ejemplar_publico
  ON ejemplar (condicion, es_ficticio, nombre);

-- Filtros del catálogo público (talla, edad, sexo).
CREATE INDEX IF NOT EXISTS idx_ejemplar_filtros
  ON ejemplar (condicion, talla_clave, edad_clave, sexo_clave);

-- Vista del capturista: sólo los ejemplares que están hoy en su centro.
CREATE INDEX IF NOT EXISTS idx_ejemplar_centro_actual
  ON ejemplar (centro_actual_clave, condicion);

-- Lista de espera: solicitudes de un ejemplar por orden de llegada.
CREATE INDEX IF NOT EXISTS idx_solicitud_espera
  ON solicitud (ejemplar_id, recibida_en);

-- Búsqueda en administración, por folio y por nombre de la persona.
CREATE INDEX IF NOT EXISTS idx_solicitud_folio
  ON solicitud (folio);
CREATE INDEX IF NOT EXISTS idx_solicitud_persona
  ON solicitud (primer_apellido, nombres);
