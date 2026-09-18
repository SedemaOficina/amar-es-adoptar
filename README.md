# Amar es Adoptar

Plataforma de adopción de seres sintientes de la **Secretaría del Medio Ambiente de la
Ciudad de México**.

Sustituye a la plataforma vigente en `amaresadoptar.cdmx.gob.mx` y corrige por
construcción sus fallas conocidas: dos fuentes de datos que no se sincronizaban, la ficha
pública rota por un identificador ambiguo, un solo perfil de usuario con permiso de
borrado, el recorte inconsistente de fotografías y la ausencia de un campo para el folio
del centro de origen.

Se construye para ser entregada. ADIP monta después dos piezas que sólo ella controla: la
autenticación con Llave CDMX y el dominio bajo `cdmx.gob.mx`. Por eso la autenticación es
una capa reemplazable por configuración y el dominio no aparece escrito en el código en
ningún punto.

## Estado

| Etapa | Alcance | Estado |
|---|---|---|
| 1 | Portal público | Cerrada |
| 2 | Administración y base de datos | Cerrada |
| 3 | Portal alimentado por la base | Cerrada |
| 4 | Solicitudes de adopción | Cerrada |
| 5 | Indicadores | Cerrada |
| 6 | Cierre de entrega a ADIP | En curso |

**Lo que detiene el proyecto no es código.** El almacén de fotografías (R2) no está
habilitado porque la cuenta de Cloudflare es personal y el proveedor exige un medio de pago
institucional, así que **el sistema no se puede desplegar**: ni para publicar lo construido
ni para corregir la versión que quedó en línea el 16 de septiembre. De ahí cuelgan la carga
del padrón real, la medición de rendimiento y el cierre de la etapa 6.

**Toda la información que hay en la base es ficticia.** Mientras exista un solo registro
marcado como tal, el portal muestra un aviso de sitio en desarrollo; se apaga solo al
retirarlos.

## Cómo está armado

```
src/pages/            Páginas. Su ruta en el disco es su dirección en el sitio.
src/servidor/         Las reglas. Nada de esto se ejecuta en el navegador.
src/cliente/          Lo único que corre en el navegador: el recorte de las
                      fotografías antes de subirlas.
src/compartido/       Lo que el servidor y el navegador tienen que saber igual.
                      Hoy, las medidas de las fotografías.
src/components/       Tarjeta del catálogo, formularios y tira de fotografías.
src/layouts/          Plantilla pública y plantilla de administración.
src/estilos/          Hoja global y declaración de tipografías. Dos paletas que
                      conviven: la del programa «Amar es Adoptar» —morado
                      #96438C— para el contenido, y la institucional —guinda
                      #9D2148— para el marco y las alertas.
src/middleware.js     Control de acceso: filtra todo lo que cuelga de /admin.
public/imagenes/      Logotipo institucional, marca del programa, los 28 iconos
                      del paquete gráfico e imágenes de muestra.
public/tipografias/   Cabin y Roboto, alojadas aquí y no pedidas a un servicio
                      externo. Con sus licencias.
migraciones/          Cambios de la base —de estructura y de datos—. Se aplican
                      en orden, una vez, con `wrangler d1 migrations apply`.
mantenimiento/        Sentencias SQL que se ejecutan a mano en un momento concreto,
                      y la comprobación de que dos bases están iguales.
carga-inicial/        Para cargar el padrón real una vez: la plantilla, el guion
                      que la valida y recorta las fotografías, y el que las sube.
                      No es una función del sistema; nada de src/ lo importa.
```

Dos principios explican casi todo el diseño:

**Las reglas viven en `src/servidor/`, no en las pantallas.** Una regla escrita dentro de
una página no se puede probar y la siguiente pantalla la olvida. El alcance por centro, la
validación, el folio, los estados de la solicitud y la frontera de lo público están cada
uno en un módulo.

**Una sola fuente de datos.** El portal público y la administración leen la misma base D1.
Lo que el personal cambia en una ficha se publica al instante: no hay sincronización, ni
copia intermedia, ni paso de publicación. Es la corrección de la falla principal de la
plataforma vigente.

### La frontera de lo público

`src/servidor/ejemplares-publico.js` es la única puerta por la que el portal lee la base, y
tiene dos funciones de lectura a propósito: la que alimenta las pantallas no trae el folio
interno, el centro ni el semáforo, y la del formulario de adopción sí, porque la solicitud
guarda una instantánea del registro. Un ejemplar dado de baja no se reconoce: el portal
responde como ante una dirección inventada.

## Levantar el proyecto

Requisitos, variables de entorno, base de datos y publicación:
[`DESPLIEGUE.md`](./DESPLIEGUE.md).

## Mapa del sistema

Dónde está cada cosa, qué ruta atiende qué, qué módulo es dueño de qué regla y cuáles son
las decisiones de arquitectura que no conviene deshacer: [`ARQUITECTURA.md`](./ARQUITECTURA.md).

## Integración con Llave CDMX

Qué pedirle a ADIP, qué variables llenar, cómo comprobar que quedó y qué es lo único que
podría requerir tocar código: [`LLAVE-CDMX.md`](./LLAVE-CDMX.md).

## Titularidad y licencia

[`TITULARIDAD.md`](./TITULARIDAD.md). La licencia de publicación está pendiente de definir
con la Dirección Jurídica, antes de la entrega formal.

## Convenciones

Todo vive en [`CLAUDE.md`](./CLAUDE.md): la regla de que nada se borra del disco, el mapa
de carpetas y las convenciones de código. `AGENTS.md` es un puntero de tres líneas que
remite a él, porque distintas herramientas buscan el suyo con distinto nombre.

**Hay una sola copia a propósito.** Antes eran dos archivos iguales unidos por un enlace
duro en el disco, y falló en el primer commit: Git no guarda enlaces duros y, además, dio
uno de los dos caminos por revisado sin volver a leerlo. En el disco parecían idénticos y
en el repositorio no. Una copia y un puntero no se desincronizan.
