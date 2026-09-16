/* Retorno del proveedor de identidad.
 *
 * Atiende dos caminos:
 *
 *   GET  — el proveedor real devuelve aquí un `code` y el `state` que le
 *          mandamos. Se comprueba el estado, se cambia el código por el
 *          identificador de la persona y se abre la sesión.
 *
 *   POST — acceso simulado de desarrollo. Existe únicamente cuando el sistema
 *          corre en una máquina local; en el sitio publicado responde como
 *          inexistente.
 */
export const prerender = false;

import { abrirSesion } from '../../servidor/sesion.js';
import { haySimulado, identificarConCodigo } from '../../servidor/identidad.js';
import { obtenerPersonaActiva, registrarAcceso } from '../../servidor/personal.js';

async function entrar({ sub, cookies, url, redirect }) {
  const persona = await obtenerPersonaActiva(sub);

  // Identificarse con el proveedor no basta: hay que estar dado de alta y
  // activo en la tabla `usuario`. El proveedor dice quién eres; la base dice
  // si tienes algo que hacer aquí.
  if (!persona) return redirect('/admin/entrar?motivo=sin-acceso');

  await abrirSesion(cookies, sub, url.protocol === 'https:');
  await registrarAcceso(persona.id);
  return redirect('/admin');
}

export async function GET({ url, cookies, redirect }) {
  const codigo = url.searchParams.get('code');
  const estadoRecibido = url.searchParams.get('state');
  const estadoEsperado = cookies.get('oidc_estado')?.value;

  cookies.delete('oidc_estado', { path: '/admin' });

  if (!codigo) return redirect('/admin/entrar?motivo=error');
  if (!estadoEsperado || estadoRecibido !== estadoEsperado) {
    return redirect('/admin/entrar?motivo=estado');
  }

  try {
    const sub = await identificarConCodigo(url, codigo);
    return entrar({ sub, cookies, url, redirect });
  } catch {
    return redirect('/admin/entrar?motivo=error');
  }
}

export async function POST({ request, cookies, url, redirect }) {
  if (!haySimulado()) return new Response(null, { status: 404 });

  const formulario = await request.formData();
  const sub = String(formulario.get('dev_sub') ?? '');

  // Aun en desarrollo, sólo se admiten los identificadores de prueba.
  if (!sub.startsWith('dev-')) return redirect('/admin/entrar?motivo=error');

  return entrar({ sub, cookies, url, redirect });
}
