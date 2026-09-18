## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Convenciones del proyecto

### Nunca se borran archivos

Nada se elimina del disco. Lo que deje de usarse se mueve a la carpeta `_a-borrar/`
en la raíz del proyecto, con una línea en su `LEEME.md` que diga qué es y por qué
salió. Liber la vacía a mano cuando quiera. Aplica a archivos, carpetas y a lo que
quede huérfano tras una refactorización.

### Carpetas de la raíz

| Carpeta | Qué contiene |
|---|---|
| `migraciones/` | Cambios de estructura de la base. Se aplican en orden, una sola vez. |
| `mantenimiento/` | Sentencias SQL que se ejecutan a mano en un momento concreto. No son migraciones. |
| `carga-inicial/` | Plantilla y reglas para la carga del padrón real. |
| `_a-borrar/` | Lo retirado, pendiente de que Liber lo elimine. Excluida del repositorio. |
| `respaldos/` | Volcados de la base antes de tocar producción. No se versiona. |

`public/tipografias/` guarda Cabin y Roboto: el sitio **no** las pide a un servicio
externo. Si alguien vuelve a enlazar Google Fonts, está reintroduciendo una dependencia
que se quitó a propósito (D-05).

### Código

- Comentarios en español. Los mantiene un equipo pequeño y no especializado.
- El comentario explica por qué, no qué: el qué ya lo dice el código.
- SQL plano, sin ORM. Los valores viajan como parámetros, nunca concatenados;
  lo que llega por la dirección se valida contra lista blanca.
- Las reglas viven en `src/servidor/`, no dentro de las pantallas.
- Una regla del programa se impone en **todas** las puertas, incluida la carga desde
  código, que entra por debajo de las pantallas.

### Nada se supone: se lee

El nombre de un comando se lee del `package.json`; el de una ruta, de `src/pages/`; el de
un parámetro, del archivo que lo recibe. Suponerlos ha costado tres vueltas en un solo día:
`npm run deploy` —que no existe—, `/catalogo` —que es `/seres-sintientes`— y `?nombre=`
—que es `?texto=`—.

### Un cambio de datos también es una migración

Todo lo que deba existir en las dos bases se escribe en `migraciones/`. Una sentencia
corrida a mano sólo pasó en la máquina donde se corrió, y las comprobaciones no lo detectan:
`verificar-estructura.sql` compara el esqueleto, no el contenido.

Contra la base remota, `d1 execute --remote --file=…` falla siempre (10000). Y cualquier
comando puede devolver un 7403 intermitente: **se repite antes de concluir nada**. Ver
`DESPLIEGUE.md` § 6.

### Los pasos se entregan con su orden

Cuando una instrucción tiene varios pasos y uno depende del anterior, se dice qué hacer si
el primero falla —y el guion mismo lo impide, no sólo el mensaje—. Una salvaguarda que vive
en el orden del código no lo es si se entregan los dos comandos juntos.

### Versionar

El repositorio es lo que se entrega a ADIP y lo único que sobrevive a una falla del disco.
Se hace commit al cerrar cada bloque de trabajo, no al final del proyecto.
