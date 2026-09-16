# Despliegue

Documento vivo. Se actualiza conforme avanzan las etapas. Está escrito para que otro
equipo pueda levantar el proyecto desde cero sin preguntarle nada a quien lo construyó.

## 1. Requisitos

| Requisito | Versión | Nota |
|---|---|---|
| Node.js | 22 o superior | Las versiones impares de Node no están soportadas por Astro |
| npm | El que trae Node | |
| Git | Cualquiera reciente | |

No se requiere base de datos ni servidor para la etapa 1: el portal es estático.

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

### Recursos que Cloudflare crea solo

El adaptador declara un espacio KV con el enlace `SESSION`, que Cloudflare aprovisiona en
el primer despliegue. El proyecto no lo usa: la sesión del personal viaja en una cookie
firmada y la validez se comprueba contra la tabla `usuario` en cada petición, de modo que
dar de baja a alguien surte efecto de inmediato. Queda declarado porque el adaptador lo
incluye por omisión; puede retirarse sin consecuencias.

## 5. Variables de entorno

Ninguna todavía. **El dominio no debe escribirse en el código en ningún punto**: cuando se
requiera una dirección absoluta, se toma de `site` en `astro.config.mjs`, que a su vez se
alimenta de una variable de entorno. Esto es lo que permite que ADIP monte el dominio
institucional sin tocar código fuente.

## 6. Base de datos (etapa 2)

El esquema vive en `migraciones/`. Todavía no se ejecuta.

```bash
# Crear la base
npx wrangler d1 create amar-es-adoptar

# Aplicar el esquema en local y en remoto
npx wrangler d1 execute amar-es-adoptar --local  --file=./migraciones/0001_inicial.sql
npx wrangler d1 execute amar-es-adoptar --remote --file=./migraciones/0001_inicial.sql
```

El esquema es SQL estándar, sin extensiones propietarias, para que pueda migrarse a
PostgreSQL si la Secretaría o ADIP deciden alojarlo en otra infraestructura.

## 7. Respaldo y exportación

```bash
npx wrangler d1 export amar-es-adoptar --remote --output=respaldo.sql
```

El volcado es SQL plano y no requiere herramienta propietaria para leerse.

## 8. Autenticación

La autenticación se construye como cliente OAuth2/OIDC estándar, con el proveedor
definido por variables de entorno. Sustituirlo por **Llave CDMX** debe ser configuración,
no reescritura. Los valores que se requerirán de ADIP:

- Identificador de cliente (`client_id`) y secreto
- URL de autorización, de token y de información de usuario
- URL de retorno (`callback`) registrada del lado de ADIP
- Ambiente de pruebas
- Qué campos de identidad entrega el token: el formulario supone nombre, apellidos, CURP,
  calle, número, código postal, alcaldía, colonia, teléfono y correo
