/* Proveedor de identidad de la persona que solicita adoptar.
 *
 * ESTE ES EL ARCHIVO QUE SE CONFIGURA PARA MONTAR LLAVE CDMX EN EL PORTAL.
 * Es el gemelo de `identidad.js`, que hace lo mismo para el personal.
 * Están separados a propósito: son dos poblaciones distintas, con dos
 * direcciones de retorno distintas, y nada garantiza que ADIP dé de alta un
 * solo cliente para ambas.
 *
 * Mientras Llave CDMX no esté disponible, en desarrollo opera un proveedor
 * simulado con personas de prueba inequívocamente falsas. Ese proveedor NO
 * existe fuera de desarrollo, por construcción.
 *
 * QUÉ CAMBIA CUANDO LLEGUE LLAVE CDMX
 *
 *   1. Se llenan las variables LLAVE_* del entorno.
 *   2. Si los nombres de los campos que devuelve no coinciden con los que
 *      usamos, se ajusta `mapearPerfil()` —y nada más—.
 *
 * No hay un tercer paso. Ninguna pantalla conoce al proveedor.
 */
import { env } from 'cloudflare:workers';

/** Dirección que hay que registrar ante ADIP para el portal ciudadano. */
export const RUTA_RETORNO = '/adoptar/callback';

export function hayProveedorReal() {
  return Boolean(env?.LLAVE_AUTORIZACION && env?.LLAVE_TOKEN && env?.LLAVE_CLIENTE_ID);
}

export function haySimulado() {
  return import.meta.env.DEV;
}

export function direccionDeRetorno(url) {
  return new URL(RUTA_RETORNO, url.origin).toString();
}

export function urlDeAutorizacion(url, estado) {
  const destino = new URL(env.LLAVE_AUTORIZACION);
  destino.searchParams.set('response_type', 'code');
  destino.searchParams.set('client_id', env.LLAVE_CLIENTE_ID);
  /* LOS DOS NOMBRES DE LA DIRECCIÓN DE RETORNO, A PROPÓSITO.
   *
   * El estándar OAuth2 lo llama `redirect_uri`. Llave CDMX lo llama
   * `redirect_url`, y no es una peculiaridad de una versión vieja: se
   * comprobó el 18/09/2026 en sus DOS puntos de autorización —el
   * `oauth.xhtml` que usa el back office de ADIP y el `oauthV2.xhtml` en
   * vivo—, y los dos aceptan exactamente tres parámetros: `client_id`,
   * `redirect_url` y `state`.
   *
   * Se mandan los dos con el mismo valor. Un proveedor estándar ignora el
   * que no conoce; Llave CDMX encuentra el suyo. Lo que se gana es que la
   * autenticación sigue siendo una capa reemplazable —requisito de la
   * entrega— en lugar de quedar atada a Llave. Lo que se paga es un
   * parámetro de más, y el riesgo pequeño de que algún proveedor muy
   * estricto rechace lo que no reconoce.
   *
   * `response_type` y `scope` se conservan por la misma razón: Llave no los
   * usa y los ignora, pero quitarlos nos ataría a Llave. Ver LLAVE-CDMX.md. */
  destino.searchParams.set('redirect_uri', direccionDeRetorno(url));
  destino.searchParams.set('redirect_url', direccionDeRetorno(url));
  destino.searchParams.set('scope', env.LLAVE_ALCANCE || 'openid profile email');
  destino.searchParams.set('state', estado);
  return destino.toString();
}

/* Traducción entre lo que devuelve el proveedor y los nombres que usa la
 * tabla `solicitud`. Es el único lugar del sistema donde aparecen los nombres
 * de campo del proveedor. Si Llave CDMX llama `apellido_paterno` a lo que
 * nosotros llamamos `primer_apellido`, se corrige aquí. */
export function mapearPerfil(perfil) {
  const sub = perfil.sub ?? perfil.id ?? perfil.curp;
  if (!sub) throw new Error('El proveedor no devolvió un identificador utilizable.');

  const texto = (v) => (v === undefined || v === null ? '' : String(v).trim());

  return {
    // No editables: llegan del proveedor y se guardan tal cual.
    sub: String(sub),
    nombres:          texto(perfil.nombres ?? perfil.given_name ?? perfil.name),
    primer_apellido:  texto(perfil.primer_apellido ?? perfil.apellido_paterno ?? perfil.family_name),
    segundo_apellido: texto(perfil.segundo_apellido ?? perfil.apellido_materno),
    curp:             texto(perfil.curp),

    // Editables: se muestran prellenados y la persona los confirma o corrige.
    calle:              texto(perfil.calle ?? perfil.street_address),
    numero_exterior:    texto(perfil.numero_exterior),
    numero_interior:    texto(perfil.numero_interior),
    codigo_postal:      texto(perfil.codigo_postal ?? perfil.postal_code),
    alcaldia:           texto(perfil.alcaldia ?? perfil.locality),
    colonia:            texto(perfil.colonia),
    telefono_celular:   texto(perfil.telefono_celular ?? perfil.phone_number),
    correo_electronico: texto(perfil.correo_electronico ?? perfil.email),

    simulada: false,
  };
}

export async function identificarConCodigo(url, codigo) {
  const respuesta = await fetch(env.LLAVE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: direccionDeRetorno(url),
      // El mismo motivo que arriba: los dos nombres, por si el canje también
      // espera el suyo. Ver el comentario de `urlDeAutorizacion`.
      redirect_url: direccionDeRetorno(url),
      client_id: env.LLAVE_CLIENTE_ID,
      client_secret: env.LLAVE_CLIENTE_SECRETO ?? '',
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`Llave CDMX rechazó el código (${respuesta.status}).`);
  }

  const token = await respuesta.json();

  const datos = await fetch(env.LLAVE_USUARIO, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (!datos.ok) {
    throw new Error(`No se pudieron obtener los datos de la persona (${datos.status}).`);
  }

  return mapearPerfil(await datos.json());
}

/* --------------------------------------------------------------------------
 * Personas de prueba del proveedor simulado.
 *
 * Todo en ellas es inequívocamente falso: la CURP no tiene forma de CURP, los
 * teléfonos son ceros y el dominio del correo es `.local`, que no existe en
 * internet. Ningún dato de aquí puede confundirse con el de una persona real
 * ni parecerlo.
 *
 * LOS NOMBRES: Fulana, Zutano y Mengano, que en México son los comodines de
 * «una persona cualquiera». Se eligieron porque cumplen dos cosas a la vez:
 * se leen como un nombre —antes decían PERSONA DE PRUEBA UNO APELLIDO-PRUEBA
 * APELLIDO-PRUEBA, que era ilegible— y nadie los confunde con alguien real.
 *
 * NO se ponen nombres verosímiles, aunque se vean mejor. Estas identidades
 * generan solicitudes con domicilio, teléfono y CURP: si parecieran de una
 * persona, alguien en un centro podría marcarle a ese teléfono, y una captura
 * de pantalla en una presentación se vería igual que una filtración de datos
 * personales. El nombre es la última defensa que sigue funcionando cuando el
 * campo `es_ficticio` no se mira.
 * ----------------------------------------------------------------------- */
export const PERSONAS_SIMULADAS = [
  {
    sub: 'dev-ciudadania-1',
    nombres: 'Fulana',
    primer_apellido: 'de Tal',
    segundo_apellido: 'Mengano',
    curp: 'CURP-DE-PRUEBA-01',
    calle: 'Calle de Prueba',
    numero_exterior: '1',
    numero_interior: '',
    codigo_postal: '00000',
    alcaldia: 'Alcaldía de Prueba',
    colonia: 'Colonia de Prueba',
    telefono_celular: '5500000001',
    correo_electronico: 'fulana-de-tal@ejemplo.local',
    simulada: true,
  },
  {
    sub: 'dev-ciudadania-2',
    nombres: 'Zutano',
    primer_apellido: 'de Tal',
    segundo_apellido: '',
    curp: 'CURP-DE-PRUEBA-02',
    // Domicilio vacío a propósito: sirve para probar qué pasa cuando el
    // proveedor no trae el domicilio y la persona tiene que capturarlo.
    calle: '',
    numero_exterior: '',
    numero_interior: '',
    codigo_postal: '',
    alcaldia: '',
    colonia: '',
    telefono_celular: '',
    correo_electronico: '',
    simulada: true,
  },
];

export function personaSimulada(sub) {
  return PERSONAS_SIMULADAS.find((p) => p.sub === sub) ?? null;
}
