-- ---------------------------------------------------------------------------
-- 0004 — Flujo de atención de la solicitud
--
-- Hasta ahora `solicitud.estado` era texto libre con el valor por omisión
-- 'RECIBIDA'. Se cierra a los seis pasos que el centro recorre de verdad:
--
--   RECIBIDA → EN_REVISION → CONTACTADA → APROBADA  → CONCLUIDA
--                                       ↘ RECHAZADA
--
-- Se agregan además `estado_en` y `estado_por`: cuándo cambió y quién lo
-- cambió. El detalle de cada movimiento queda en `bitacora`, que ya admite la
-- entidad SOLICITUD; estas dos columnas son para no tener que consultarla
-- sólo para saber en qué punto va y desde cuándo.
--
-- SQLite no permite agregar un CHECK a una columna existente, así que la
-- tabla se rehace. Nada apunta a `solicitud`, de modo que es seguro.
-- ---------------------------------------------------------------------------

CREATE TABLE solicitud_nueva (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Folio de trazabilidad de la solicitud, formato AAAA-NNNNNN.
  -- Distinto del folio interno del ejemplar.
  folio               TEXT NOT NULL UNIQUE,
  recibida_en         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- Flujo de atención de la solicitud. Los seis valores son los pasos reales
  -- del centro; sin esta lista cerrada, cada quien escribiría el suyo y los
  -- indicadores dejarían de significar algo.
  estado              TEXT NOT NULL DEFAULT 'RECIBIDA'
                      CHECK (estado IN ('RECIBIDA', 'EN_REVISION', 'CONTACTADA',
                                        'APROBADA', 'RECHAZADA', 'CONCLUIDA')),
  estado_en           TEXT,
  estado_por          INTEGER REFERENCES usuario(id),
  es_ficticio         INTEGER NOT NULL DEFAULT 0 CHECK (es_ficticio IN (0, 1)),

  -- --- Ejemplar: referencia viva más instantánea congelada ------------
  ejemplar_id         INTEGER REFERENCES ejemplar(id) ON DELETE SET NULL,
  snap_folio_interno  TEXT NOT NULL,
  snap_centro_origen  TEXT NOT NULL,
  snap_centro_actual  TEXT NOT NULL,
  snap_semaforo       TEXT NOT NULL,
  snap_nombre         TEXT NOT NULL,
  snap_edad           TEXT NOT NULL,
  snap_sexo           TEXT NOT NULL,
  snap_talla          TEXT NOT NULL,
  snap_condicion      TEXT NOT NULL,

  -- --- Persona solicitante --------------------------------------------
  -- Nombre, apellidos y CURP llegan de Llave CDMX y no son editables.
  -- Domicilio y contacto llegan precargados pero la persona puede
  -- corregirlos; se guarda lo que confirmó, no lo que traía su cuenta.
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

  -- --- Cuestionario de valoración --------------------------------------
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

  -- Las preguntas 2 y 8 son de opción múltiple y exigen al menos una
  -- respuesta. La opción G ("no puedo comprometerme" / "vivo solo") es
  -- excluyente: el documento lo dice y la base lo impone, para que no
  -- dependa de que el formulario valide bien.
  CHECK (p2_a + p2_b + p2_c + p2_d + p2_e + p2_f + p2_g >= 1),
  CHECK (p2_g = 0 OR (p2_a + p2_b + p2_c + p2_d + p2_e + p2_f) = 0),
  CHECK (p8_a + p8_b + p8_c + p8_d + p8_e + p8_f + p8_g >= 1),
  CHECK (p8_g = 0 OR (p8_a + p8_b + p8_c + p8_d + p8_e + p8_f) = 0)
);

INSERT INTO solicitud_nueva
  (id, folio, recibida_en, estado, es_ficticio,
   ejemplar_id, snap_folio_interno, snap_centro_origen, snap_centro_actual, snap_semaforo,
   snap_nombre, snap_edad, snap_sexo, snap_talla, snap_condicion,
   llave_sub, nombres, primer_apellido, segundo_apellido, curp,
   calle, numero_exterior, numero_interior, codigo_postal, alcaldia,
   colonia, telefono_celular, correo_electronico, p1, p2_a,
   p2_b, p2_c, p2_d, p2_e, p2_f,
   p2_g, p3, p4, p5, p6,
   p7, p8_a, p8_b, p8_c, p8_d,
   p8_e, p8_f, p8_g, p9)
SELECT
   id, folio, recibida_en, estado, es_ficticio,
   ejemplar_id, snap_folio_interno, snap_centro_origen, snap_centro_actual, snap_semaforo,
   snap_nombre, snap_edad, snap_sexo, snap_talla, snap_condicion,
   llave_sub, nombres, primer_apellido, segundo_apellido, curp,
   calle, numero_exterior, numero_interior, codigo_postal, alcaldia,
   colonia, telefono_celular, correo_electronico, p1, p2_a,
   p2_b, p2_c, p2_d, p2_e, p2_f,
   p2_g, p3, p4, p5, p6,
   p7, p8_a, p8_b, p8_c, p8_d,
   p8_e, p8_f, p8_g, p9
  FROM solicitud;

DROP TABLE solicitud;

ALTER TABLE solicitud_nueva RENAME TO solicitud;
