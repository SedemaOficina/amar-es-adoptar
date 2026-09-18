-- ---------------------------------------------------------------------------
-- 0006 — Baja de ejemplares con motivo
--
-- QUÉ AGREGA
--
-- La condición BAJA y su motivo. Distingue dos cosas que hoy se confunden:
--
--   · Un registro equivocado —duplicado, captura errónea recién hecha— que
--     nunca debió existir. Ése se borra.
--   · Un animal que sí existió y salió del programa: falleció, se trasladó
--     fuera, lo recogió su familia. Ése NO se borra: se da de baja con motivo,
--     porque si alguien llegó a solicitarlo, su historia importa.
--
-- POR QUÉ SE REHACEN TRES TABLAS Y NO UNA
--
-- `fotografia` y `solicitud` cuelgan de `ejemplar` con borrado en cascada.
-- Al eliminar la tabla vieja, esa cascada se lleva las 66 fotografías y
-- desvincula las solicitudes. Está comprobado: con las claves foráneas
-- activas —que es como opera D1— la versión ingenua de esta migración
-- destruye los datos.
--
-- D1 NO admite `PRAGMA foreign_keys = off`; sólo `defer_foreign_keys`, que no
-- sirve aquí porque el borrado en cascada es una acción, no una comprobación
-- que pueda aplazarse.
--
-- La salida es el orden: se crean las tres tablas nuevas, las hijas apuntando
-- ya a `ejemplar_nuevo`; se sueltan primero las hijas —que no son madre de
-- nadie y no arrastran nada— y al final la madre, que para entonces ya no
-- tiene quien cuelgue de ella. Al renombrar, SQLite actualiza solo las
-- referencias de las hijas.
--
-- Funciona en cualquier SQLite sin depender de un PRAGMA, que también importa
-- para la entrega: ADIP podría alojarlo en otra infraestructura.
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
                             ('FALLECIMIENTO', 'TRASLADO_EXTERNO', 'DUPLICADO', 'OTRO')),
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

-- Copia de los datos. Las hijas se copian ANTES de soltar nada.
INSERT INTO ejemplar_nuevo
  (id, slug, centro_origen_clave, folio_interno, centro_actual_clave,
   nombre, edad_clave, sexo_clave, talla_clave, semaforo,
   condicion, es_ficticio, creado_en, actualizado_en, creado_por,
   actualizado_por)
SELECT
   id, slug, centro_origen_clave, folio_interno, centro_actual_clave,
   nombre, edad_clave, sexo_clave, talla_clave, semaforo,
   condicion, es_ficticio, creado_en, actualizado_en, creado_por,
   actualizado_por
  FROM ejemplar;

INSERT INTO fotografia_nueva
  (id, ejemplar_id, orden, clave_original, clave_ficha,
   clave_tarjeta, clave_miniatura, texto_alternativo, ancho, alto,
   bytes, creado_en)
SELECT
   id, ejemplar_id, orden, clave_original, clave_ficha,
   clave_tarjeta, clave_miniatura, texto_alternativo, ancho, alto,
   bytes, creado_en
  FROM fotografia;

INSERT INTO solicitud_nueva
  (id, folio, recibida_en, estado, estado_en,
   estado_por, es_ficticio, ejemplar_id, snap_folio_interno, snap_centro_origen,
   snap_centro_actual, snap_semaforo, snap_nombre, snap_edad, snap_sexo,
   snap_talla, snap_condicion, llave_sub, nombres, primer_apellido,
   segundo_apellido, curp, calle, numero_exterior, numero_interior,
   codigo_postal, alcaldia, colonia, telefono_celular, correo_electronico,
   p1, p2_a, p2_b, p2_c, p2_d,
   p2_e, p2_f, p2_g, p3, p4,
   p5, p6, p7, p8_a, p8_b,
   p8_c, p8_d, p8_e, p8_f, p8_g,
   p9)
SELECT
   id, folio, recibida_en, estado, estado_en,
   estado_por, es_ficticio, ejemplar_id, snap_folio_interno, snap_centro_origen,
   snap_centro_actual, snap_semaforo, snap_nombre, snap_edad, snap_sexo,
   snap_talla, snap_condicion, llave_sub, nombres, primer_apellido,
   segundo_apellido, curp, calle, numero_exterior, numero_interior,
   codigo_postal, alcaldia, colonia, telefono_celular, correo_electronico,
   p1, p2_a, p2_b, p2_c, p2_d,
   p2_e, p2_f, p2_g, p3, p4,
   p5, p6, p7, p8_a, p8_b,
   p8_c, p8_d, p8_e, p8_f, p8_g,
   p9
  FROM solicitud;

-- Primero las hijas: no son madre de nadie, soltarlas no arrastra nada.
DROP TABLE fotografia;
DROP TABLE solicitud;

-- Ahora sí la madre: ya nadie cuelga de ella.
DROP TABLE ejemplar;

ALTER TABLE ejemplar_nuevo   RENAME TO ejemplar;
ALTER TABLE fotografia_nueva RENAME TO fotografia;
ALTER TABLE solicitud_nueva  RENAME TO solicitud;
