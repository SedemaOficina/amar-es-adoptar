-- ---------------------------------------------------------------------------
-- 0003 — Permitir el intercambio de orden entre fotografías
--
-- PROBLEMA
-- La tabla `fotografia` tiene UNIQUE (ejemplar_id, orden). Intercambiar dos
-- fotografías exige que, por un instante, una de ellas suelte su posición
-- antes de que la otra la ocupe. SQLite comprueba la unicidad después de cada
-- sentencia, no al final de la transacción, así que el intercambio directo
-- falla siempre:
--   D1_ERROR: UNIQUE constraint failed: fotografia.ejemplar_id, fotografia.orden
--
-- SOLUCIÓN
-- Se admite un valor de orden negativo como posición transitoria. La regla de
-- negocio no cambia: las posiciones válidas siguen siendo 1, 2 y 3. El rango
-- negativo existe únicamente dentro del lote de tres sentencias que hace el
-- intercambio, y ese lote es una sola transacción: si algo se interrumpe, no
-- queda ningún registro en negativo.
--
-- SQLite no permite modificar un CHECK existente, así que hay que rehacer la
-- tabla. Nada apunta a `fotografia`, de modo que recrearla es seguro.
-- ---------------------------------------------------------------------------

CREATE TABLE fotografia_nueva (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ejemplar_id       INTEGER NOT NULL REFERENCES ejemplar(id) ON DELETE CASCADE,
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

INSERT INTO fotografia_nueva
  (id, ejemplar_id, orden, clave_original, clave_ficha, clave_tarjeta,
   clave_miniatura, texto_alternativo, ancho, alto, bytes, creado_en)
SELECT
   id, ejemplar_id, orden, clave_original, clave_ficha, clave_tarjeta,
   clave_miniatura, texto_alternativo, ancho, alto, bytes, creado_en
  FROM fotografia;

DROP TABLE fotografia;

ALTER TABLE fotografia_nueva RENAME TO fotografia;
