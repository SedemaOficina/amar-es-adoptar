# Integración con Llave CDMX

Documento de entrega. Va dirigido a quien tenga que conectar la plataforma **Amar es
Adoptar** con Llave CDMX, sea de la Agencia Digital de Innovación Pública o de la Secretaría
del Medio Ambiente.

**La idea de fondo, en una frase:** montar Llave CDMX consiste en llenar variables de
entorno. **No hay que tocar código fuente**, salvo un ajuste posible —y acotado a dos
funciones— si los nombres de los campos que devuelve el proveedor no coinciden con los que
la plataforma espera. La sección 6 dice exactamente cuáles y dónde.

---

## 1. Por qué está construido así

El encargo de esta plataforma establece que la autenticación tiene que ser **una capa
reemplazable y no código entretejido con el resto**, porque el sistema se construyó en la
Secretaría para entregarse después. De ahí tres decisiones que conviene conocer antes de
configurar nada:

1. **Es un cliente OAuth2/OIDC estándar**, con flujo de código de autorización. No hay nada
   propio de ningún proveedor en el diseño.
2. **El dominio no está escrito en el código.** La dirección de retorno se arma con el
   dominio de la petición en curso. Cambiar de dominio no obliga a tocar código ni a
   redesplegar con otra configuración.
3. **Ninguna pantalla conoce al proveedor.** Todo lo que sabe de él vive en dos archivos.

---

## 2. Son DOS clientes, no uno

La plataforma identifica a dos poblaciones distintas, y cada una tiene su propio cliente,
su propia dirección de retorno y su propio juego de variables.

| | Personal de la Secretaría | Ciudadanía |
|---|---|---|
| Para qué | Entrar a la administración: capturar ejemplares, atender solicitudes | Enviar una solicitud de adopción |
| Dirección de retorno | `https://<dominio>/admin/callback` | `https://<dominio>/adoptar/callback` |
| Prefijo de las variables | `OIDC_` | `LLAVE_` |
| Archivo que lo implementa | `src/servidor/identidad.js` | `src/servidor/identidad-ciudadana.js` |

**Están separados a propósito.** Son dos poblaciones con permisos y datos distintos, y nada
garantiza que ADIP dé de alta un solo cliente para ambas. Si diera uno solo, las dos
direcciones de retorno tendrían que quedar registradas en ese cliente y los dos juegos de
variables se llenarían con los mismos valores, cambiando sólo el `redirect_uri`. El sistema
funciona igual en los dos escenarios.

---

## 3. Qué hay que pedirle a ADIP

Esto es lo que la Secretaría necesita recibir para que la integración quede:

| Dato | Variable que llena | ¿Es secreto? |
|---|---|---|
| Dirección de autorización | `OIDC_AUTORIZACION` · `LLAVE_AUTORIZACION` | No |
| Dirección del token | `OIDC_TOKEN` · `LLAVE_TOKEN` | No |
| Dirección de datos de la persona | `OIDC_USUARIO` · `LLAVE_USUARIO` | No |
| Identificador de cliente | `OIDC_CLIENTE_ID` · `LLAVE_CLIENTE_ID` | No |
| Secreto de cliente | `OIDC_CLIENTE_SECRETO` · `LLAVE_CLIENTE_SECRETO` | **Sí** |
| Alcance autorizado | `OIDC_ALCANCE` · `LLAVE_ALCANCE` | No |

Y además, dos cosas que no son variables:

- **Un ambiente de pruebas**, para no ensayar contra producción.
- **El registro de las dos direcciones de retorno** de la sección 2, que ADIP tiene que dar
  de alta de su lado. Un proveedor OAuth2 rechaza cualquier dirección de retorno que no
  tenga registrada, y es el error más común al integrar.

### El alcance: el correo electrónico no es opcional

Para el personal, el alcance tiene que incluir **el identificador de la persona y su correo
electrónico**. No es una comodidad: es la única forma de que alguien recién autorizado pueda
entrar la primera vez.

El flujo es éste. La Secretaría da de alta a una persona por su **correo**, porque en ese
momento nadie conoce todavía el identificador que Llave CDMX le va a asignar. Cuando esa
persona entra por primera vez, el sistema recibe del proveedor un identificador y un correo,
busca si hay un registro esperando ese correo, y ata los dos. De ahí en adelante manda el
identificador y el correo deja de importar.

**Sin el correo en el alcance, nadie puede entrar la primera vez**, y no hay forma de
resolverlo desde la administración. El mecanismo está en `vincularPorCorreo`, en
`src/servidor/personal-admin.js`.

Para la ciudadanía el alcance incluye además la **CURP**, que la solicitud de adopción
guarda como parte de la identificación de la persona solicitante.

---

## 4. Cómo se configura

Los valores que no son secretos pueden ir como variables de entorno del Worker; el secreto
de cliente y el secreto de sesión **nunca se escriben en un archivo versionado**.

En desarrollo, se copia `.dev.vars.ejemplo` como `.dev.vars` y se llenan ahí. Ese archivo
está excluido del repositorio.

En el sitio publicado, cada secreto se carga una vez:

```
npx wrangler secret put OIDC_CLIENTE_SECRETO
npx wrangler secret put LLAVE_CLIENTE_SECRETO
npx wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` es propio de la plataforma y no viene de ADIP: firma la cookie de sesión
del personal. Se genera uno largo y aleatorio, distinto en cada ambiente.

### El interruptor es automático

Ninguno de los dos archivos tiene un modo que se active a mano. Cada uno pregunta si hay
proveedor configurado:

```js
export function hayProveedorReal() {
  return Boolean(env?.OIDC_AUTORIZACION && env?.OIDC_TOKEN && env?.OIDC_CLIENTE_ID);
}
```

Con esas tres variables llenas, el proveedor real entra en funcionamiento. Sin ellas, en
desarrollo opera un acceso simulado y en el sitio publicado el sistema avisa que el acceso
no está configurado.

**El acceso simulado no existe fuera de desarrollo, por construcción**: está atado a
`import.meta.env.DEV`, que el compilador resuelve al construir. En el sitio publicado esas
rutas responden «no encontrado». No hay una casilla que alguien pueda dejar encendida por
descuido.

---

## 5. Cómo se comprueba que quedó

En este orden, porque cada paso descarta una causa distinta:

1. **La pantalla de acceso ya no ofrece usuarios de prueba.** Si los sigue ofreciendo, las
   variables no llegaron al Worker.
2. **Al entrar, el navegador va a la pantalla de Llave CDMX.** Si no sale de la plataforma,
   `OIDC_AUTORIZACION` está mal.
3. **Después de identificarse, el navegador regresa a `/admin/callback`.** Si el proveedor
   responde que la dirección de retorno no es válida, falta registrarla del lado de ADIP.
4. **El sistema no rechaza el retorno.** Si redirige con `?motivo=estado`, el parámetro
   `state` no volvió igual que como se mandó; si redirige con `?motivo=error`, el proveedor
   rechazó el código o no se pudieron leer los datos de la persona.
5. **Una persona dada de alta entra; una que no está dada de alta recibe «sin acceso».**
   Esto último es correcto y conviene probarlo: identificarse con Llave CDMX **no** da
   acceso. La Secretaría autoriza a cada persona en la pantalla de Personal.
6. **El mismo recorrido para la ciudadanía**, desde la ficha de un ejemplar: «Adóptame» →
   identificación → formulario prellenado con los datos de la cuenta.

El detalle de cualquier fallo queda en el registro del Worker (`wrangler tail` o el panel de
observabilidad), no en la pantalla: los mensajes de error no se muestran al usuario.

---

## 6. Lo único que podría requerir tocar código

Si Llave CDMX devuelve los datos de la persona con nombres de campo distintos a los
previstos, hay **dos funciones** donde se corrige, y ninguna otra parte del sistema conoce
esos nombres.

**Para el personal**, al final de `identificarConCodigo` en `src/servidor/identidad.js`:

```js
const sub = perfil.sub ?? perfil.id ?? perfil.curp;
const correo = perfil.email ?? perfil.correo ?? perfil.correo_electronico ?? null;
```

**Para la ciudadanía**, la función `mapearPerfil` en `src/servidor/identidad-ciudadana.js`,
que traduce el perfil del proveedor a los nombres que usa la tabla `solicitud`. Ya contempla
varias formas habituales —`primer_apellido`, `apellido_paterno`, `family_name`— y basta
agregar la que corresponda.

> **Si hay que tocar algo fuera de esas dos funciones, algo se entendió mal.** Conviene
> revisarlo antes de escribir el cambio: el resto del sistema está construido para no saber
> quién autentica.

---

## 7. Qué no hay que hacer

- **No escribir el dominio en el código.** La dirección de retorno se arma sola con el
  dominio de la petición. Si alguien la fija, el sistema deja de funcionar al cambiar de
  ambiente y el defecto aparece en producción.
- **No versionar `.dev.vars`** ni ningún secreto. Está excluido en `.gitignore`.
- **No reutilizar el mismo `SESSION_SECRET`** entre el ambiente de pruebas y el publicado.
- **No dar de alta personal desde la base de datos.** La pantalla de Personal registra quién
  autorizó a quién y cuándo; un `INSERT` a mano se salta la bitácora.
- **No tocar `sameSite` en la cookie de sesión.** Sostiene la protección contra peticiones
  cruzadas de todos los formularios de la administración. La advertencia completa está en
  `src/servidor/sesion.js`.

---

## 8. Dónde está cada cosa

| Archivo | Qué contiene |
|---|---|
| `src/servidor/identidad.js` | Cliente OAuth2 del personal |
| `src/servidor/identidad-ciudadana.js` | Cliente OAuth2 de la ciudadanía y traducción del perfil |
| `src/pages/admin/entrar.astro` | Pantalla de acceso; genera el `state` y redirige al proveedor |
| `src/pages/admin/callback.js` | Retorno del proveedor para el personal |
| `src/pages/adoptar/callback.js` | Retorno del proveedor para la ciudadanía |
| `src/servidor/sesion.js` | Cookie de sesión del personal, firmada |
| `src/servidor/personal-admin.js` | Alta de personal y atadura por correo del primer ingreso |
| `.dev.vars.ejemplo` | Plantilla de todas las variables, con su explicación |
| `DESPLIEGUE.md` | Cómo levantar el proyecto completo desde cero |
