# Despliegue

Documento vivo. Se actualiza conforme avanzan las etapas. Está escrito para que otro
equipo pueda levantar el proyecto desde cero sin preguntarle nada a quien lo construyó.

## 1. Requisitos

| Requisito | Versión | Nota |
|---|---|---|
| Node.js | 22 o superior | Las versiones impares de Node no están soportadas por Astro |
| npm | El que trae Node | |
| Git | Cualquiera reciente | |

Se requiere además la base de datos local de Wrangler: desde la etapa 3 el portal público
lee de la misma base que la administración, así que sin ella no arranca. El apartado 4
explica cómo crearla.

## 2. Levantar el proyecto en local

```bash
git clone <URL-DEL-REPOSITORIO>
cd amar-es-adoptar
npm install
npm run dev
```

El sitio queda en `http://localhost:4321`.

Para verlo desde un teléfono en la misma red:

```bash
npm run dev -- --host
```

y se abre la dirección que aparece como `Network`.

## 3. Construir para producción

```bash
npm run build
```

Genera el sitio estático en `dist/`. Para revisarlo antes de publicar:

```bash
npm run preview
```

## 4. Publicación en Cloudflare

El sitio se publica como un **Worker** que sirve las páginas estáticas del portal y
genera en el servidor las de administración. Se eligió así, y no como proyecto de
Cloudflare Pages, porque el portal público y la administración quedan en un solo
despliegue y leen de una sola base de datos.

### Cómo se reparte la configuración

`wrangler.jsonc`, en la raíz, contiene **sólo la identidad del Worker y sus enlaces**:
nombre, fecha de compatibilidad, banderas y la base D1.

No lleva `main` ni `assets`, y no debe llevarlos: el adaptador de Astro toma ese archivo,
le agrega el punto de entrada y las carpetas que produce al construir, y escribe la
configuración completa en `dist/server/wrangler.json`. Declararlos en la raíz hace que
`npm run dev` falle, porque apuntan a archivos que sólo existen después de construir.

### Ajustes en el panel de Cloudflare

| Parámetro | Valor |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy -c dist/server/wrangler.json` |

El `-c` es indispensable: sin él, wrangler lee el archivo de la raíz, no encuentra qué
publicar y falla.

Cada envío a la rama `main` dispara una publicación automática. Las demás ramas generan
vistas previas con dirección propia.

Para desplegar desde la propia máquina:

```bash
npm run build
npx wrangler deploy -c dist/server/wrangler.json
```

### Recursos que hay que crear

| Recurso | Enlace | Para qué | Cómo se crea |
|---|---|---|---|
| Base D1 | `DB` | Toda la información del sistema | `npx wrangler d1 create amar-es-adoptar` |
| Almacén R2 | `FOTOS` | Las fotografías de los ejemplares | `npx wrangler r2 bucket create amar-es-adoptar-fotos` |
| Espacio KV | `SESSION` | Sesión de la persona solicitante | `npx wrangler kv namespace create SESSION` |

Los tres identificadores se escriben en `wrangler.jsonc`. **Ninguno es opcional.**

El espacio KV merece una advertencia, porque su nombre no lo dice: ahí viven los datos
personales de quien llena una solicitud —nombre, CURP, domicilio y contacto— mientras dura
el trámite. La cookie sólo lleva el identificador de la sesión; el contenido se queda del
lado del servidor. Sin este enlace el formulario de adopción deja de funcionar.

La sesión del **personal** es otra cosa y no usa ese espacio: viaja en una cookie firmada
y se comprueba contra la tabla `usuario` en cada petición, de modo que dar de baja a
alguien surte efecto de inmediato.

## 5. Variables de entorno

La plantilla completa y comentada está en [`.dev.vars.ejemplo`](./.dev.vars.ejemplo). Se
copia como `.dev.vars` para el trabajo local; **ese archivo nunca se versiona**. En
producción los mismos valores se cargan como secretos:

```bash
npx wrangler secret put SESSION_SECRET
```

| Variable | Obligatoria | Para qué |
|---|---|---|
| `SESSION_SECRET` | Sí | Firma la cookie de sesión del personal. Uno propio por ambiente; nunca se reutiliza. |
| `OIDC_*` | No | Proveedor de identidad del **personal**. Vacías, en desarrollo opera el acceso simulado; fuera de desarrollo el sistema avisa que el acceso no está configurado. |
| `LLAVE_*` | No | Proveedor de identidad de la **ciudadanía**. Mismo comportamiento. |

Al llenar las variables del proveedor, éste entra en funcionamiento sin tocar código: es
lo que convierte el montaje de Llave CDMX en configuración y no en reescritura.

**El dominio no se escribe en el código en ningún punto.** Cuando se requiera una
dirección absoluta se toma de `site` en `astro.config.mjs`, alimentado por variable de
entorno. Esto permite que ADIP monte el dominio institucional sin tocar código fuente.

## 6. Base de datos

El esquema vive en `migraciones/`. **No se aplican a mano.** De aplicarlas se encarga
`wrangler d1 migrations apply`, que lleva la cuenta de cuáles ya se corrieron en la tabla
`d1_migrations` y sólo ejecuta las que faltan.

Esto no es una comodidad, es una salvaguarda: varias migraciones **reconstruyen tablas**
—la 0004 y la 0006 crean una tabla nueva, copian los datos y sustituyen la vieja—.
Correrlas por segunda vez sobre datos reales es perder información.

| Archivo | Qué hace |
|---|---|
| `0001_inicial.sql` | Esquema completo: catálogos, ejemplar, fotografía, solicitud, bitácora, personal. |
| `0002_datos_ficticios.sql` | 30 ejemplares de prueba y las cuentas de desarrollo. Se retira antes de cargar datos reales. |
| `0003_orden_fotografias.sql` | Admite una posición transitoria negativa para poder intercambiar el orden de dos fotografías. |
| `0004_solicitud_estado.sql` | Los seis estados de la solicitud, con la fecha y la persona que hizo el último cambio. **Reconstruye `solicitud`.** |
| `0005_solicitudes_ficticias.sql` | Solicitudes de prueba. Se retiran junto con el resto de los datos ficticios. |
| `0006_baja_de_ejemplares.sql` | Condición de baja con motivo obligatorio, nota, fecha y persona que la ordenó. **Reconstruye `ejemplar`, `fotografia` y `solicitud`.** |
| `0007_personal.sql` | Correos distintos por persona, índice único sobre el correo y vínculo con el identificador de Llave CDMX. |

### Base nueva, desde cero

```bash
# 1. Crear la base y copiar el database_id que devuelve a wrangler.jsonc
npx wrangler d1 create amar-es-adoptar

# 2. Aplicar TODAS las migraciones, en orden, de una vez
npx wrangler d1 migrations apply amar-es-adoptar --local
npx wrangler d1 migrations apply amar-es-adoptar --remote

# 3. Comprobar que quedó completa
npx wrangler d1 execute amar-es-adoptar --local --file=mantenimiento/verificar-estructura.sql
```

La carpeta se declara en `wrangler.jsonc`, **dentro** de la entrada de la base, no al
principio del archivo:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "amar-es-adoptar",
    "database_id": "…",
    "migrations_dir": "migraciones"
  }
]
```

### Una migración nueva

```bash
# Crea el archivo con el número que sigue
npx wrangler d1 migrations create amar-es-adoptar nombre-descriptivo

# Se escribe el SQL, se prueba en local, y sólo entonces va a remoto
npx wrangler d1 migrations apply amar-es-adoptar --local
npx wrangler d1 migrations apply amar-es-adoptar --remote
```

**Antes de aplicar a la base remota, siempre un respaldo** (sección 7).

Si la migración cambia la estructura, hay que actualizar los números esperados en
`mantenimiento/verificar-estructura.sql`. Una comprobación desactualizada no sólo deja de
servir: empieza a avisar de errores que no existen, y se le deja de hacer caso.

### Comprobar si dos bases están iguales

```bash
npx wrangler d1 migrations list amar-es-adoptar --remote
```

Debe responder `✅ No migrations to apply!`. Eso dice qué migraciones están **registradas**,
que no es lo mismo que qué hay realmente en la base. Para verificar la estructura misma:

```bash
npx wrangler d1 execute amar-es-adoptar --remote --file=mantenimiento/verificar-estructura.sql
```

### Advertencia: la API de D1 responde de forma intermitente

El 17 y 18 de septiembre de 2026, los comandos que tocan la base remota devolvieron
`[code: 7403]` —«the given account is not valid or is not authorized»— de forma
**intermitente y sin patrón**. El mismo comando, con la misma cuenta y el mismo token,
falla y al repetirlo funciona:

| Momento | `d1 execute --remote --command` | `d1 migrations apply --remote` |
|---|---|---|
| 17/09 por la tarde | 7403 | Funcionó |
| 18/09 de madrugada | Funcionó | 7403 |
| 18/09, un minuto después | — | Funcionó |

**Ante un 7403, lo primero es repetir el comando.** No es un permiso faltante: `wrangler
whoami` muestra `d1 (write)` en el alcance del token, y `d1 migrations list --remote`
responde bien incluso cuando `apply` falla.

**No hay que rediseñar el procedimiento alrededor de este fallo.** Se intentó —se dio por
cerrado el endpoint `/query` y se escribió aquí que la remota «sólo se toca por
migración»— y era falso: bastaba reintentar. De un solo intento fallido no se deduce una
regla.

Lo que sí es cierto y no cambia:

- `d1 execute --remote --file=…` devuelve `Authentication error [code: 10000]` de forma
  consistente, con token OAuth y permisos de administrador. `--file` no manda una consulta:
  sube el archivo por el endpoint de importación, que exige más permisos. Una sentencia
  suelta contra la remota se pasa con `--command`.
- Un error de autorización en un comando **no significa que la sesión haya vencido**: antes
  de `wrangler login`, repetir el comando y probar otro contra el mismo recurso.

### Bases que existían antes de este registro

Una base creada antes del 17 de septiembre de 2026 tiene migraciones aplicadas a mano y la
tabla `d1_migrations` vacía. Aplicar así reintentaría todas, incluidas las que reconstruyen
tablas. Hay que sembrar el registro primero:
`mantenimiento/sembrar-registro-de-migraciones.sql`, **después** de comprobar una por una
cuáles están realmente puestas. El archivo explica el procedimiento y el accidente que lo
hizo necesario.

## 6.1 Sentencias de mantenimiento

`mantenimiento/` no son migraciones: son sentencias que se ejecutan a mano, en un momento
concreto, y que no forman parte de la secuencia del esquema. Se aplican igual:

```bash
npx wrangler d1 execute amar-es-adoptar --local  --file=mantenimiento/<archivo>.sql
```

| Archivo | Cuándo |
|---|---|
| `verificar-estructura.sql` | Cuantas veces se quiera. Sólo lee. Después de aplicar migraciones y antes de cualquier entrega. |
| `marcar-todo-como-prueba.sql` | Mientras no exista un solo dato real. Deja de usarse el día que entra el padrón. |
| `retirar-datos-de-prueba.sql` | Una sola vez, con el padrón real ya cargado y verificado, y con respaldo previo. |
| `sembrar-registro-de-migraciones.sql` | Sólo en una base anterior al 17 de septiembre de 2026, y sólo después de comprobar qué tiene de verdad. Ver sección 6. |

Detalle y advertencias en `mantenimiento/LEEME.md`.

## 7. Respaldo y exportación

```bash
npx wrangler d1 export amar-es-adoptar --remote --output respaldos/respaldo-AAAA-MM-DD.sql
```

El volcado es SQL plano y no requiere herramienta propietaria para leerse.

**Siempre antes de aplicar migraciones a la base remota.** La 0004 y la 0006 reconstruyen
tablas: si algo falla a la mitad, el respaldo es la única vuelta atrás.

La carpeta `respaldos/` **no se versiona**: los volcados crecen sin control y, en cuanto
haya información real, serían datos personales de solicitantes dentro del repositorio.

## 8. Autenticación

La autenticación se construye como cliente OAuth2/OIDC estándar, con el proveedor
definido por variables de entorno. Sustituirlo por **Llave CDMX** debe ser configuración,
no reescritura. Los valores que se requerirán de ADIP:

- Identificador de cliente (`client_id`) y secreto
- URL de autorización, de token y de información de usuario
- **Dos** direcciones de retorno (`callback`) registradas del lado de ADIP, porque son dos
  clientes distintos: `/admin/callback` para el personal y `/adoptar/callback` para la
  ciudadanía. Nada garantiza que ADIP dé de alta un solo cliente.
- Ambiente de pruebas
- Qué campos de identidad entrega el token: el formulario supone nombre, apellidos, CURP,
  calle, número, código postal, alcaldía, colonia, teléfono y correo
