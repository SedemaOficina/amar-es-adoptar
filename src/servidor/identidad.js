/* Proveedor de identidad del personal administrador.
 *
 * ESTE ES EL ARCHIVO QUE SE CONFIGURA PARA MONTAR LLAVE CDMX.
 *
 * La autenticación está construida como cliente OAuth2/OIDC estándar, con
 * flujo de código de autorización: se redirige a la pantalla del proveedor,
 * éste devuelve un `code` y un `state` a nuestra dirección de retorno, y con
 * el código se pide el token y los datos de la persona.
 *
 * Mientras Llave CDMX no esté dada de alta, en desarrollo opera un proveedor
 * simulado que permite entrar como cualquiera de los usuarios de prueba. Ese
 * proveedor NO existe fuera de desarrollo, por construcción.
 *
 * Para conectar Llave CDMX no se toca este código: se definen sus variables
 * de entorno y el proveedor simulado deja de usarse solo.
 *
 * La dirección de retorno se arma con el dominio de la petición en curso, no
 * con un valor escrito en el código. Es requisito de la entrega: cambiar de
 * dominio no debe obligar a tocar código fuente.
 */
import { env } from 'cloudflare:workers';

export const RUTA_RETORNO = '/admin/callback';

/** ¿Hay un proveedor real configurado? */
export function hayProveedorReal() {
  return Boolean(env?.OIDC_AUTORIZACION && env?.OIDC_TOKEN && env?.OIDC_CLIENTE_ID);
}

/** El proveedor simulado sólo vive en la máquina de quien desarrolla. */
export function haySimulado() {
  return import.meta.env.DEV;
}

export function direccionDeRetorno(url) {
  return new URL(RUTA_RETORNO, url.origin).toString();
}

/** Arma la dirección a la que se manda a la persona para que se identifique. */
export function urlDeAutorizacion(url, estado) {
  const destino = new URL(env.OIDC_AUTORIZACION);
  destino.searchParams.set('response_type', 'code');
  destino.searchParams.set('client_id', env.OIDC_CLIENTE_ID);
  destino.searchParams.set('redirect_uri', direccionDeRetorno(url));
  destino.searchParams.set('scope', env.OIDC_ALCANCE || 'openid profile email');
  destino.searchParams.set('state', estado);
  return destino.toString();
}

/** Cambia el código de autorización por el identificador de la persona. */
export async function identificarConCodigo(url, codigo) {
  const respuesta = await fetch(env.OIDC_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: direccionDeRetorno(url),
      client_id: env.OIDC_CLIENTE_ID,
      client_secret: env.OIDC_CLIENTE_SECRETO ?? '',
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`El proveedor de identidad rechazó el código (${respuesta.status}).`);
  }

  const token = await respuesta.json();

  // Preferimos preguntar por los datos de la persona en lugar de descifrar el
  // token nosotros: es menos código y menos formas de equivocarse.
  const datos = await fetch(env.OIDC_USUARIO, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (!datos.ok) {
    throw new Error(`No se pudieron obtener los datos de la persona (${datos.status}).`);
  }

  const perfil = await datos.json();
  const sub = perfil.sub ?? perfil.id ?? perfil.curp;

  if (!sub) {
    throw new Error('El proveedor no devolvió un identificador de persona utilizable.');
  }

  return String(sub);
}
