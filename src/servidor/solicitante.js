/* Sesión de la persona que solicita adoptar.
 *
 * DÓNDE VIVEN SUS DATOS Y POR QUÉ
 *
 * El nombre, los apellidos, la CURP y el domicilio de la persona son datos
 * personales. NO viajan en la cookie: la cookie lleva únicamente un
 * identificador de sesión, y los datos se guardan del lado del servidor, en
 * el almacén de sesiones de Astro (respaldado por Cloudflare KV).
 *
 * Si viajaran en la cookie —aunque fuera firmada— quedarían legibles en el
 * equipo de quien usa el portal y en cualquier registro que capture
 * cabeceras. Para una plataforma de gobierno que recaba CURP, eso no es
 * aceptable.
 *
 * La sesión es efímera: dura lo que dura el trámite. No existe registro de
 * ciudadanía en la base; la única huella de la persona es la solicitud que
 * envió.
 */

const CLAVE = 'solicitante';

/** Datos de la persona identificada, o null si no se ha identificado. */
export async function leerSolicitante(session) {
  if (!session) return null;
  return (await session.get(CLAVE)) ?? null;
}

export async function abrirSesionSolicitante(session, persona) {
  if (!session) throw new Error('El almacén de sesiones no está disponible.');
  // Identificador nuevo al iniciar sesión: evita que alguien fije de antemano
  // el identificador de sesión de otra persona.
  await session.regenerate();
  session.set(CLAVE, persona, { ttl: 60 * 60 }); // una hora
}

export function cerrarSesionSolicitante(session) {
  session?.destroy();
}
