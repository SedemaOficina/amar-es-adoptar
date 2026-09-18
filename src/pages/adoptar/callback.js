/* Retorno del proveedor de identidad ciudadana.
 *
 *   GET  — Llave CDMX devuelve aquí `code` y `state`. Se comprueba el estado,
 *          se cambia el código por los datos de la persona y se abre la
 *          sesión. El ejemplar al que hay que regresar viaja en una cookie
 *          porque la dirección de retorno registrada ante ADIP es una sola.
 *
 *   POST — identificación simulada de desarrollo. No existe fuera de él.
 */
export const prerender = false;

import { abrirSesionSolicitante } from '../../servidor/solicitante.js';
import {
  haySimulado, identificarConCodigo, personaSimulada,
} from '../../servidor/identidad-ciudadana.js';

/** Sólo se admite volver a una ruta de este mismo sitio. */
function destinoSeguro(slug) {
  return /^[a-z0-9-]{1,80}$/.test(String(slug ?? '')) ? `/adoptar/${slug}` : '/seres-sintientes';
}

export async function GET({ url, cookies, session, redirect }) {
  const codigo = url.searchParams.get('code');
  const estadoRecibido = url.searchParams.get('state');
  const estadoEsperado = cookies.get('llave_estado')?.value;
  const destino = destinoSeguro(cookies.get('llave_destino')?.value);

  cookies.delete('llave_estado', { path: '/adoptar' });
  cookies.delete('llave_destino', { path: '/adoptar' });

  if (!codigo) return redirect(`${destino}?motivo=error`);
  if (!estadoEsperado || estadoRecibido !== estadoEsperado) {
    return redirect(`${destino}?motivo=estado`);
  }

  try {
    const persona = await identificarConCodigo(url, codigo);
    await abrirSesionSolicitante(session, persona);
    return redirect(destino);
  } catch {
    return redirect(`${destino}?motivo=error`);
  }
}

export async function POST({ request, session, redirect }) {
  if (!haySimulado()) return new Response(null, { status: 404 });

  const formulario = await request.formData();
  const persona = personaSimulada(String(formulario.get('dev_sub') ?? ''));
  const destino = destinoSeguro(formulario.get('destino'));

  // Aun en desarrollo, sólo se admiten las identidades de prueba declaradas.
  if (!persona) return redirect(`${destino}?motivo=error`);

  await abrirSesionSolicitante(session, persona);
  return redirect(destino);
}
