-- =====================================================================
-- AMAR ES ADOPTAR — Plataforma de adopción de seres sintientes
-- Secretaría del Medio Ambiente de la Ciudad de México
--
-- Migración 0001 — esquema inicial
-- Motor: SQLite (Cloudflare D1)
--
-- Ejecutar en local:      wrangler d1 execute amar-es-adoptar --local  --file=./migraciones/0001_inicial.sql
-- Ejecutar en remoto:     wrangler d1 execute amar-es-adoptar --remote --file=./migraciones/0001_inicial.sql
--
-- Convenciones del esquema:
--   · Nombres en español, minúsculas, sin acentos, singular.
--   · Fechas y horas en texto ISO 8601 UTC ('2026-09-15T18:42:00Z').
--     SQLite no tiene tipo fecha; el texto ISO ordena correctamente y es
--     el formato que cualquier otro motor sabe leer al migrar.
--   · Sin booleanos: SQLite no los tiene. Se usa INTEGER 0/1 con CHECK.
--   · SQL estándar, sin extensiones propietarias, para que el esquema
--     pueda migrarse a PostgreSQL si ADIP decide alojar el sistema.
-- =====================================================================

PRAGMA foreign_keys = ON;


-- =====================================================================
-- 1. CATÁLOGOS ADMINISTRABLES
--
-- Cuatro tablas de forma idéntica. SEDEMA, como administrador global,
-- puede agregar o retirar valores desde la administración sin tocar
-- código. La bandera 'activo' permite retirar un valor de los formularios
-- sin romper los registros históricos que ya lo usan: por eso no se
-- borran, se desactivan.
--
-- 'clave' es el valor estable que viaja al CSV de exportación y nunca
-- cambia. 'etiqueta' es lo que ve la persona usuaria y sí puede editarse.
-- =====================================================================

CREATE TABLE centro (
  clave    TEXT PRIMARY KEY,
  etiqueta TEXT NOT NULL,
  orden    INTEGER NOT NULL,
  activo   INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE edad (
  clave    TEXT PRIMARY KEY,
  etiqueta TEXT NOT NULL,
  orden    INTEGER NOT NULL,
  activo   INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE sexo (
  clave    TEXT PRIMARY KEY,
  etiqueta TEXT NOT NULL,
  orden    INTEGER NOT NULL,
  activo   INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE talla (
  clave    TEXT PRIMARY KEY,
  etiqueta TEXT NOT NULL,
  orden    INTEGER NOT NULL,
  activo   INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

-- Nota: SEMÁFORO CONDUCTUAL y CONDICIÓN no son tablas de catálogo.
-- Gobiernan lógica de negocio —el botón "Adóptame" y qué se muestra al
-- público— y no deben poder alterarse desde una pantalla. Van como
-- restricciones CHECK en la tabla 'ejemplar'.


-- =====================================================================
-- 2. PERSONAL
--
-- Sólo personal de la plataforma. La ciudadanía no tiene registro aquí:
-- se identifica con Llave CDMX al enviar una solicitud y su identidad
-- queda en el propio registro de la solicitud.
--
-- 'oidc_sub' es el identificador que entrega el proveedor de identidad.
-- Es lo único que ata este esquema a la autenticación, y es un campo de
-- texto: cambiar de proveedor a Llave CDMX no toca la estructura.
-- =====================================================================

CREATE TABLE usuario (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  oidc_sub      TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('ADMIN_GLOBAL', 'CAPTURISTA')),
  centro_clave  TEXT REFERENCES centro(clave),
  activo        INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ultimo_acceso TEXT,

  -- El administrador global (SEDEMA) no pertenece a ningún centro;
  -- el capturista pertenece obligatoriamente a uno. La base lo impone
  -- para que no pueda existir un capturista sin adscripción, que sería
  -- un usuario capaz de ver todo por accidente.
  CHECK (
    (rol = 'ADMIN_GLOBAL' AND centro_clave IS NULL) OR
    (rol = 'CAPTURISTA'   AND centro_clave IS NOT NULL)
  )
);


-- =====================================================================
-- 3. EJEMPLAR
--
-- Tres identificadores distintos, cada uno con un trabajo:
--
--   id            interno de la base. Nunca se captura, nunca se muestra,
--                 nunca viaja en una URL. Sólo sirve para las relaciones.
--   slug          identificador de la dirección pública. Se genera al
--                 alta y es inmutable. Nunca puede venir nulo, que es lo
--                 que rompe hoy la ficha de la plataforma vigente.
--   folio_interno el que asigna el centro y con el que opera. Cinco
--                 dígitos, con ceros a la izquierda. Se guarda como TEXTO
--                 precisamente para conservar esos ceros: como número,
--                 '00147' se convertiría en 147.
--
-- El folio es único DENTRO de su centro de origen, no en toda la base:
-- dos centros pueden tener cada uno su ejemplar 00147.
--
-- Centro de origen y centro actual son campos distintos porque un
-- ejemplar puede trasladarse. El origen forma la clave y jamás cambia;
-- el actual dice dónde está el animal hoy y es el que determina qué
-- capturista puede verlo.
-- =====================================================================

CREATE TABLE ejemplar (
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
                      CHECK (condicion IN ('DISPONIBLE', 'EN_PROCESO', 'ADOPTADO')),

  -- Marca inequívoca de dato de desarrollo. El portal muestra un aviso
  -- visible mientras exista un solo registro con este valor en 1.
  es_ficticio         INTEGER NOT NULL DEFAULT 0 CHECK (es_ficticio IN (0, 1)),

  creado_en           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  creado_por          INTEGER REFERENCES usuario(id),
  actualizado_por     INTEGER REFERENCES usuario(id),

  -- Exactamente cinco dígitos. GLOB es la comparación de patrón de
  -- SQLite; esto rechaza '147', '0014A' y '001470' en la propia base,
  -- no sólo en el formulario.
  CHECK (length(folio_interno) = 5 AND folio_interno GLOB '[0-9][0-9][0-9][0-9][0-9]'),

  UNIQUE (centro_origen_clave, folio_interno)
);

-- Consulta del catálogo público: siempre filtra por condición y ordena.
CREATE INDEX idx_ejemplar_publico
  ON ejemplar (condicion, es_ficticio, nombre);

-- Filtros del catálogo público (talla, edad, sexo).
CREATE INDEX idx_ejemplar_filtros
  ON ejemplar (condicion, talla_clave, edad_clave, sexo_clave);

-- Vista del capturista: sólo los ejemplares que están hoy en su centro.
CREATE INDEX idx_ejemplar_centro_actual
  ON ejemplar (centro_actual_clave, condicion);


-- =====================================================================
-- 4. FOTOGRAFÍAS
--
-- Tabla aparte, no columnas en 'ejemplar'. Así el límite de tres es una
-- restricción de la base y no una convención que alguien pueda romper.
--
-- Una sola proporción en todo el sitio, con tres derivados generados al
-- momento de subir el archivo. Guardar las tres rutas —en lugar de
-- transformar al vuelo— es lo que mantiene el almacenamiento portable:
-- son objetos normales en R2, que habla el protocolo S3.
--
-- 'texto_alternativo' no es opcional en la práctica: es un portal de
-- gobierno y la accesibilidad lo exige.
-- =====================================================================

CREATE TABLE fotografia (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ejemplar_id       INTEGER NOT NULL REFERENCES ejemplar(id) ON DELETE CASCADE,
  orden             INTEGER NOT NULL CHECK (orden BETWEEN 1 AND 3),

  clave_original    TEXT NOT NULL,
  clave_ficha       TEXT NOT NULL,
  clave_tarjeta     TEXT NOT NULL,
  clave_miniatura   TEXT NOT NULL,

  texto_alternativo TEXT,
  ancho             INTEGER,
  alto              INTEGER,
  bytes             INTEGER,
  creado_en         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- La fotografía 1 es la portada que se muestra en la tarjeta.
  UNIQUE (ejemplar_id, orden)
);


-- =====================================================================
-- 5. SOLICITUD DE ADOPCIÓN
--
-- Cuatro bloques: la solicitud, la instantánea del ejemplar, la persona
-- solicitante y el cuestionario.
--
-- La instantánea (columnas 'snap_') congela los datos del ejemplar tal
-- como estaban al enviarse la solicitud, conforme lo exige el documento
-- de requerimientos. Si mañana el capturista corrige la talla, la
-- solicitud debe seguir diciendo lo que la persona vio cuando la envió.
--
-- Por eso 'ejemplar_id' es ON DELETE SET NULL y no CASCADE: si un centro
-- borra un ejemplar, la solicitud sobrevive completa gracias a su
-- instantánea. Perder solicitudes ciudadanas por un borrado sería
-- inadmisible ante la Ley de Protección de Datos Personales.
--
-- Lo que NO se guarda, a propósito:
--   · P2_CONCATENAR y P8_CONCATENAR se calculan al exportar. Un campo
--     concatenado almacenado es un campo que tarde o temprano deja de
--     coincidir con las banderas que resume.
--   · La posición en lista de espera se deriva del orden de 'recibida_en'
--     dentro de cada ejemplar.
-- =====================================================================

CREATE TABLE solicitud (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Folio de trazabilidad de la solicitud, formato AAAA-NNNNNN.
  -- Distinto del folio interno del ejemplar.
  folio               TEXT NOT NULL UNIQUE,
  recibida_en         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  estado              TEXT NOT NULL DEFAULT 'RECIBIDA',
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

-- Lista de espera: solicitudes de un ejemplar por orden de llegada.
CREATE INDEX idx_solicitud_espera ON solicitud (ejemplar_id, recibida_en);

-- Búsqueda en administración, por folio y por nombre de la persona.
CREATE INDEX idx_solicitud_folio   ON solicitud (folio);
CREATE INDEX idx_solicitud_persona ON solicitud (primer_apellido, nombres);


-- =====================================================================
-- 6. BITÁCORA
--
-- El documento exige registrar cada cambio de condición con valor
-- anterior, valor nuevo, usuario y fecha. Se generaliza a toda acción
-- controlada: alta, cambio, baja, traslado entre centros y acceso a
-- datos personales.
--
-- 'respaldo' guarda el registro completo en JSON antes de una baja, de
-- modo que un borrado físico sea reconstruible. Es la salvaguarda que
-- hace tolerable que un centro pueda borrar sus propios ejemplares.
-- =====================================================================

CREATE TABLE bitacora (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entidad        TEXT NOT NULL CHECK (entidad IN ('EJEMPLAR','SOLICITUD','USUARIO','FOTOGRAFIA')),
  entidad_id     INTEGER NOT NULL,
  accion         TEXT NOT NULL CHECK (accion IN ('ALTA','CAMBIO','BAJA','TRASLADO','ACCESO_DATO_PERSONAL')),
  campo          TEXT,
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  usuario_id     INTEGER REFERENCES usuario(id),
  ocurrido_en    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ip             TEXT,
  respaldo       TEXT
);

CREATE INDEX idx_bitacora_entidad ON bitacora (entidad, entidad_id, ocurrido_en);
CREATE INDEX idx_bitacora_usuario ON bitacora (usuario_id, ocurrido_en);


-- =====================================================================
-- 7. CARGA MASIVA
--
-- Da trazabilidad e idempotencia al importador de CSV: permite saber qué
-- archivo cargó quién, cuántos renglones entraron y cuáles fallaron, y
-- evita que volver a subir el mismo archivo duplique ejemplares.
-- =====================================================================

CREATE TABLE importacion (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_archivo TEXT NOT NULL,
  huella         TEXT NOT NULL,
  usuario_id     INTEGER REFERENCES usuario(id),
  iniciada_en    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  concluida_en   TEXT,
  filas_total    INTEGER NOT NULL DEFAULT 0,
  filas_alta     INTEGER NOT NULL DEFAULT 0,
  filas_cambio   INTEGER NOT NULL DEFAULT 0,
  filas_error    INTEGER NOT NULL DEFAULT 0,
  reporte        TEXT
);


-- =====================================================================
-- 8. VALORES INICIALES DE CATÁLOGO
-- Tomados del apartado 3.4 del documento de requerimientos.
-- =====================================================================

INSERT INTO centro (clave, etiqueta, orden) VALUES
  ('BVA',     'BRIGADA DE VIGILANCIA ANIMAL', 1),
  ('AJUSCO',  'AJUSCO',                       2),
  ('GALEANA', 'DEPORTIVO GALEANA',            3);

INSERT INTO edad (clave, etiqueta, orden) VALUES
  ('JOVEN',    'JOVEN (1-4)',    1),
  ('ADULTO',   'ADULTO (5-7)',   2),
  ('GERIATRA', 'GERIATRA (8+)',  3);

INSERT INTO sexo (clave, etiqueta, orden) VALUES
  ('HEMBRA', 'HEMBRA', 1),
  ('MACHO',  'MACHO',  2);

INSERT INTO talla (clave, etiqueta, orden) VALUES
  ('CHICO',   'CHICO',   1),
  ('MEDIANO', 'MEDIANO', 2),
  ('GRANDE',  'GRANDE',  3);
