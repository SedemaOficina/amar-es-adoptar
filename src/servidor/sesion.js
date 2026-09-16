/* Sesión del personal administrador.
 *
 * La sesión viaja en una cookie firmada que contiene únicamente el
 * identificador de la persona en el proveedor de identidad y una fecha de
 * caducidad. NO contiene el perfil ni el centro de adscripción: esos se leen
 * de la tabla `usuario` en cada petición.
 *
 * Esa decisión importa. Significa que dar de baja a alguien, cambiarle el
 * perfil o moverlo de centro surte efecto en la siguiente página que abra,
 * sin esperar a que caduque nada. Si el perfil viajara en la cookie, una
 * persona dada de baja seguiría entrando hasta que expirara.
 *
 * La firma usa HMAC-SHA256 con un secreto que vive en las variables del
 * entorno, nunca en el código.
 */
import { env } from 'cloudflare:workers';

const NOMBRE_COOKIE = 'sesion';
const DURACION_HORAS = 8; // una jornada laboral

/** Convierte bytes a texto seguro para cookies (base64 sin caracteres problemáticos). */
function aBase64Url(bytes) {
  let binario = '';
  for (const b of new Uint8Array(bytes)) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto) {
  const relleno = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(relleno + '==='.slice((relleno.length + 3) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function obtenerSecreto() {
  const secreto = env?.SESSION_SECRET;
  if (!secreto) {
    throw new Error(
      'Falta SESSION_SECRET. En desarrollo se define en el archivo .dev.vars; ' +
      'en producción con: npx wrangler secret put SESSION_SECRET'
    );
  }
  return secreto;
}

async function llave() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(obtenerSecreto()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function firmar(texto) {
  const firma = await crypto.subtle.sign('HMAC', await llave(), new TextEncoder().encode(texto));
  return aBase64Url(firma);
}

/** Comparación que tarda lo mismo coincidan o no, para no filtrar información
 *  a quien intente adivinar una firma midiendo tiempos. */
function sonIguales(a, b) {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

/** Arma el valor firmado que se guarda en la cookie. */
export async function crearValorSesion(sub) {
  const contenido = aBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ sub, exp: Date.now() + DURACION_HORAS * 3600 * 1000 })
    )
  );
  return `${contenido}.${await firmar(contenido)}`;
}

/** Devuelve el identificador de la persona, o null si la cookie falta,
 *  fue alterada o caducó. */
export async function leerSesion(cookies) {
  const valor = cookies.get(NOMBRE_COOKIE)?.value;
  if (!valor) return null;

  const [contenido, firma] = valor.split('.');
  if (!contenido || !firma) return null;

  if (!sonIguales(firma, await firmar(contenido))) return null;

  try {
    const { sub, exp } = JSON.parse(new TextDecoder().decode(deBase64Url(contenido)));
    if (!sub || !exp || Date.now() > exp) return null;
    return sub;
  } catch {
    return null;
  }
}

export async function abrirSesion(cookies, sub, esSeguro) {
  cookies.set(NOMBRE_COOKIE, await crearValorSesion(sub), {
    path: '/',
    httpOnly: true,       // el JavaScript de la página no puede leerla
    secure: esSeguro,     // sólo viaja por HTTPS fuera de desarrollo
    sameSite: 'lax',      // no se envía desde otros sitios
    maxAge: DURACION_HORAS * 3600,
  });
}

export function cerrarSesion(cookies) {
  cookies.delete(NOMBRE_COOKIE, { path: '/' });
}
