-- Paso 9 — Personal con acceso al sistema.
--
-- Prepara la tabla `usuario` para que la Secretaría pueda dar de alta personal
-- desde una pantalla, en lugar de que alguien lo escriba en la base.
--
-- EL PROBLEMA
-- La columna `oidc_sub` guarda el identificador que devuelve el proveedor de
-- identidad (Llave CDMX). Ese valor no se conoce antes de que la persona entre
-- por primera vez: lo genera el proveedor. Una pantalla de alta que lo pidiera
-- nacería inservible.
--
-- LA SOLUCIÓN, Y POR QUÉ ÉSTA
-- Mientras la persona no ha entrado nunca, `oidc_sub` guarda un marcador:
--     pendiente:<correo>
-- En el primer ingreso, el sistema busca por correo, encuentra el renglón y
-- sustituye el marcador por el identificador real. A partir de ahí manda el
-- identificador y el correo deja de ser la llave.
--
-- La alternativa era permitir que `oidc_sub` se quedara vacía. En SQLite eso
-- obliga a reconstruir la tabla, y SEIS tablas apuntan a `usuario` —bitacora,
-- ejemplar (tres columnas), solicitud e importacion—, así que habría que
-- reconstruirlas todas. Es la operación que en la migración 0006 estuvo a
-- punto de llevarse por delante las fotografías. El marcador consigue lo mismo
-- sin tocar la estructura.
--
-- Lo que se sacrifica: la columna deja de significar sólo «identificador del
-- proveedor». Se compensa con un nombre inconfundible y con una comprobación
-- en `personal-admin.js` que rechaza un identificador que llegue empezando por
-- «pendiente:».

-- 1. Las cuatro cuentas de desarrollo compartían un mismo correo. Con el
--    correo hecho único eso ya no puede ser, y de todos modos no debía serlo:
--    el correo es lo que identifica a una persona antes de su primer ingreso.
UPDATE usuario SET correo = 'desarrollo.admin@ejemplo.local'    WHERE oidc_sub = 'dev-admin';
UPDATE usuario SET correo = 'desarrollo.bva@ejemplo.local'      WHERE oidc_sub = 'dev-bva';
UPDATE usuario SET correo = 'desarrollo.ajusco@ejemplo.local'   WHERE oidc_sub = 'dev-ajusco';
UPDATE usuario SET correo = 'desarrollo.galeana@ejemplo.local'  WHERE oidc_sub = 'dev-galeana';

-- 2. El correo, único y sin distinguir mayúsculas.
--    Se indexa sobre LOWER(correo) y no sobre la columna a secas porque
--    «Maria.Lopez@…» y «maria.lopez@…» son la misma persona para cualquiera
--    menos para una comparación literal. El alta guarda siempre en minúsculas;
--    el índice es la red por si alguna vez no lo hiciera.
CREATE UNIQUE INDEX IF NOT EXISTS usuario_correo_unico ON usuario (LOWER(correo));

-- 3. Búsqueda por identificador del proveedor. Ya existía como restricción
--    UNIQUE, pero el índice explícito deja clara la intención y sirve a la
--    consulta de cada petición.
CREATE INDEX IF NOT EXISTS usuario_por_sub ON usuario (oidc_sub);

-- Comprobación: cuatro personas, cuatro correos distintos, ninguna pendiente.
SELECT COUNT(*)                                             AS personas,
       COUNT(DISTINCT LOWER(correo))                        AS correos_distintos,
       SUM(CASE WHEN oidc_sub LIKE 'pendiente:%' THEN 1 ELSE 0 END) AS sin_primer_ingreso
  FROM usuario;
