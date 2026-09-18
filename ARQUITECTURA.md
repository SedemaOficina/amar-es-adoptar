# Mapa del sistema

Documento de entrega. Sirve para orientarse: dónde está cada cosa, qué hace, y qué
decisiones no conviene deshacer sin entender por qué se tomaron.

**Si acabas de llegar**, el apartado 8 dice en qué orden leer. No hace falta recorrer todo
esto antes de tocar nada.

---

## 1. Qué es el sistema

Una plataforma de adopción de animales de compañía de la Secretaría del Medio Ambiente de la
Ciudad de México. Tiene dos caras sobre **una sola fuente de datos**:

- **El portal público**, donde la ciudadanía conoce a los animales en adopción y envía su
  solicitud.
- **La administración**, donde el personal de los centros captura ejemplares, sube
  fotografías y atiende las solicitudes.

Está construido con **Astro** sobre **Cloudflare Workers**: la base de datos es **D1**
(SQLite administrado), las fotografías viven en **R2** (almacén compatible con el protocolo
S3) y las sesiones de la ciudadanía en **KV**.

**Todas las páginas se generan en el servidor.** No hay una aplicación de JavaScript que
consuma una API aparte: cada pantalla consulta la base y devuelve HTML. El navegador sólo
recibe guiones para lo que de verdad ocurre de su lado —recortar una fotografía antes de
subirla, avisar de un folio repetido mientras se escribe—.

> **Por qué importa esto.** La plataforma que este sistema sustituye tenía el portal público
> y la administración sobre dos servicios distintos que no se sincronizaban: había registros
> visibles al público que no aparecían en la administración y no podían borrarse, y
> registros en la administración que nunca llegaban al portal. Una sola fuente de datos es
> la corrección de fondo de todo el proyecto.

---

## 2. El mapa de carpetas

```
migraciones/     Historia completa de la base de datos, en orden
mantenimiento/   Consultas de comprobación y limpieza que no son migraciones
carga-inicial/   Guiones de terminal para cargar el padrón con sus fotografías
public/          Lo que se sirve tal cual: logotipos, iconos, tipografías, robots.txt
src/
  pages/         Cada archivo es una dirección del sitio
  layouts/       Las dos plantillas: portal público y administración
  components/    Piezas que se repiten en varias pantallas
  servidor/      Las reglas del programa y todo lo que toca la base
  cliente/       Lo poco que corre en el navegador
  compartido/    Lo que el servidor y el navegador tienen que saber igual
  estilos/       global.css y las tipografías
  middleware.js  El filtro por el que pasa toda petición a /admin
```

**La regla que ordena todo:** las reglas del programa viven en `src/servidor/`, **nunca en
las pantallas**. Un formulario es comodidad para quien captura; lo que decide si algo se
guarda está del otro lado. Una regla escrita sólo en la pantalla desaparece en cuanto
alguien entra por otra puerta —una carga masiva, otra pantalla, un punto de acceso nuevo—.

---

## 3. Las direcciones del sitio

### Portal público

| Dirección | Qué es |
|---|---|
| `/` | Página informativa: por qué adoptar, qué saber antes, qué tener listo, y una vitrina de ejemplares |
| `/seres-sintientes` | Catálogo con filtros y paginación |
| `/seres-sintientes/[slug]` | Ficha del ejemplar |
| `/adoptar/[slug]` | Formulario de solicitud |
| `/adoptar/[slug]/identificarse` | Identificación con Llave CDMX, antes del formulario |
| `/adoptar/[slug]/enviada` | Acuse con el folio de la solicitud |
| `/aviso-de-privacidad` | Aviso de privacidad del trámite |
| `/404`, `/500` | Páginas de error con la identidad del sitio |

### Administración

Todo lo que cuelga de `/admin` pasa por `src/middleware.js` y exige sesión.

| Dirección | Qué es |
|---|---|
| `/admin` | Inicio, con las cifras de operación |
| `/admin/entrar` · `/admin/callback` · `/admin/salir` | Acceso, retorno del proveedor y cierre de sesión |
| `/admin/catalogo` | Catálogo con filtros y búsqueda |
| `/admin/ejemplar/nuevo` | Alta de ejemplar, con sus fotografías |
| `/admin/ejemplar/[slug]` | Ficha: edición, baja, reincorporación, borrado e historial |
| `/admin/ejemplar/[slug]/fotos` | Fotografías del ejemplar |
| `/admin/solicitudes` | Solicitudes recibidas, con filtros |
| `/admin/solicitudes/[folio]` | Ficha de la solicitud y cambio de estado |
| `/admin/indicadores` | Tablero de operación |
| `/admin/personal` | Quién entra al sistema. **Sólo administración global** |
| `/admin/almacen` | Cruce entre la base y el almacén de fotografías. **Sólo administración global** |

### Puntos de acceso que no son página

| Dirección | Qué hace |
|---|---|
| `/fotos/[...ruta]` | Entrega las fotografías del almacén. Público, sólo bajo el prefijo `ejemplar/` |
| `/admin/ejemplar/folio-libre.json` | Dice si un folio está libre, mientras se escribe el alta |
| `/admin/solicitudes/exportar` | Descarga las solicitudes en CSV. Queda registrada en bitácora |
| `/admin/ejemplar/[slug]/tira` | Fragmento de HTML: la tira de fotografías, para repintarla sin recargar |
| `/adoptar/callback` | Retorno del proveedor de identidad para la ciudadanía |

**No hay rutas de prueba ni de documentación publicadas.** Es una debilidad expresa de la
plataforma que este sistema sustituye, que dejó `/test-captcha` y `/documentation` en
producción.

---

## 4. Los módulos del servidor

| Archivo | De qué es dueño |
|---|---|
| `base-de-datos.js` | **Único punto del proyecto que sabe cómo se alcanza la base.** Todo lo demás le pide la conexión a él |
| `ejemplares-publico.js` | La única puerta por la que el portal público lee la base. Lo que no se pida aquí, el portal no lo puede enseñar |
| `ejemplares-admin.js` | Consultas del catálogo de administración, con el alcance por centro |
| `ejemplar-escritura.js` | Alta, edición, baja, reincorporación, borrado y bitácora de ejemplares. **Todas las reglas del registro** |
| `fotografias.js` | Los archivos en R2 y sus rutas en la tabla. Ninguna de las dos cosas sirve sin la otra, así que todo lo que las toca pasa por aquí |
| `almacen-auditoria.js` | Cruza la base con el almacén en los dos sentidos y retira los archivos sin dueño |
| `solicitudes.js` | Reglas de la solicitud: qué es válida, qué folio le toca, qué se guarda |
| `solicitudes-admin.js` | Las solicitudes vistas desde la administración, con alcance y registro de acceso a datos personales |
| `cuestionario.js` | El texto literal de las preguntas de valoración, tomado del documento de requerimientos |
| `solicitante.js` | La sesión de quien solicita adoptar, y dónde viven sus datos mientras dura el trámite |
| `personal.js` | Quién es la persona que está usando la administración. **El perfil y el centro no viajan en la cookie**: se leen de la base en cada petición |
| `personal-admin.js` | Quién puede entrar, con qué perfil y sobre qué centro |
| `sesion.js` | La cookie firmada del personal |
| `identidad.js` | Cliente OAuth2 del personal. **Se configura para montar Llave CDMX** |
| `identidad-ciudadana.js` | Cliente OAuth2 de la ciudadanía, y la traducción del perfil que devuelve el proveedor |
| `indicadores.js` | El tablero de operación |
| `territorio.js` | Las dieciséis alcaldías. Viven en el código porque no cambian y no hay nada que administrar |

Del lado del navegador hay un solo archivo con trabajo real, `cliente/fotografias.js`, que
recorta la imagen elegida a los cuatro tamaños **antes** de subirla. Las medidas que ese
recorte usa están en `compartido/fotografias-medidas.js`, que es el único archivo que el
servidor y el navegador leen igual: si las dos mitades no coincidieran, las fotografías
saldrían de distinto tamaño según por dónde entraran.

---

## 5. La base de datos

Nueve tablas propias, más la que Wrangler administra para llevar la cuenta de las
migraciones.

| Tabla | Qué guarda |
|---|---|
| `ejemplar` | El registro de cada animal |
| `fotografia` | Las rutas de sus imágenes en el almacén, con su orden |
| `solicitud` | Las solicitudes de adopción, con una instantánea del ejemplar al momento de pedirlo |
| `usuario` | El personal con acceso, su perfil y su centro |
| `bitacora` | Quién hizo qué, cuándo y desde qué dirección |
| `centro` · `sexo` · `edad` · `talla` | Catálogos |

**Toda la historia está en `migraciones/`, en orden.** Un cambio de estructura *y también un
cambio de datos* se hacen con una migración: lo que se corre a mano sólo ocurre en la máquina
donde se corrió, y las dos bases —la local y la publicada— quedan distintas sin que nada
avise. `mantenimiento/verificar-estructura.sql` compara el esqueleto de las dos.

---

## 6. Las decisiones que no se deshacen sin entenderlas

Son pocas y sostienen el resto. Cada una está explicada donde vive; aquí va el resumen para
que nadie las cambie creyendo que son un detalle.

**Una sola fuente de datos.** Portal y administración leen la misma base. No hay
sincronización que se pueda romper porque no hay nada que sincronizar.

**Las reglas viven en el servidor, no en las pantallas.** Y no en una sola puerta: la regla
de que un ejemplar sin fotografía no se publica está en el alta, en la consulta pública, en
el borrado **y** en el guion de carga inicial, que entra por debajo de los tres.

**El perfil y el centro se leen de la base en cada petición, no de la cookie.** Por eso dar
de baja a alguien surte efecto de inmediato en lugar de esperar a que caduque su sesión.

**El dominio no está escrito en el código en ningún punto.** Las direcciones de retorno del
proveedor de identidad se arman con el dominio de la petición en curso. Es requisito de la
entrega: cambiar de dominio no debe obligar a tocar código fuente.

**La autenticación es un cliente OAuth2/OIDC estándar configurado por variables de entorno.**
Ninguna pantalla conoce al proveedor. Ver `LLAVE-CDMX.md`.

**Las fotografías se recortan en el navegador, a una sola proporción, con encuadre
superior.** El encuadre superior es lo que protege la cabeza del animal cuando la fotografía
original es vertical; el sistema anterior recortaba al centro en dos proporciones distintas
y cortaba cabezas. Y las claves del almacén llevan un sello propio, así que un archivo nunca
pisa a otro y la dirección de una fotografía nunca cambia.

**La cookie de sesión es `sameSite: 'lax'`.** Eso es lo que hace que los formularios de la
administración no necesiten un testigo anti-CSRF. La advertencia completa está en
`sesion.js`; cambiarlo abre quince puertas a la vez sin que nada falle ni avise.

**Nada se borra sin dejar constancia.** La baja de un ejemplar exige motivo y nota; el
borrado definitivo guarda en la bitácora lo que borró; abrir o descargar datos personales de
una solicitud queda registrado con la dirección desde la que se hizo.

---

## 7. Los dos perfiles de personal

| | Administración global | Capturista |
|---|---|---|
| Alcance | Los tres centros | Únicamente el suyo |
| Personal y almacén | Sí | No existen para él: responden «no encontrado» |
| Alta y edición de ejemplares | Sí | Sólo en su centro |
| Baja y borrado | Sí | Sólo de su centro (D-121) |
| Solicitudes | Todas | Sólo las de su centro |

El alcance **no vive en la pantalla**: una consulta por la dirección de un ejemplar de otro
centro responde «no existe», no un botón apagado.

---

## 8. Por dónde empezar a leer

En este orden, que va de lo general a lo concreto:

1. **`README.md`** — qué es el proyecto y en qué estado está.
2. **`DESPLIEGUE.md`** — cómo levantarlo desde cero.
3. **`src/middleware.js`** — son sesenta líneas y explican de un vistazo cómo se protege la
   administración.
4. **`migraciones/0001_inicial.sql`** — el modelo de datos, con sus comentarios.
5. **`src/servidor/ejemplar-escritura.js`** — las reglas del registro, que son el corazón
   del programa.
6. **`LLAVE-CDMX.md`** — si lo que te toca es la integración de identidad.

**Los comentarios del código no son adorno.** Este sistema lo va a mantener un equipo
pequeño y no especializado, así que cada decisión no obvia está explicada junto al código que
la implementa, con el porqué y con lo que se sacrificó al tomarla. Antes de cambiar algo que
parezca raro, conviene leer el comentario de al lado: casi siempre está ahí la razón.
