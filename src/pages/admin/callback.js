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
import { vincularPorCorreo, identificadorYaAtado } from '../../servidor/personal-admin.js';

async function entrar({ sub, correo, cookies, url, redirect }) {
  /* Primer ingreso: la Secretaría autorizó un correo y todavía no existe
     identificador que guardar. Si hay un renglón esperando por ese correo, se
     ata aquí y a partir de ahora manda el identificador.

     Va ANTES de comprobar el acceso, no en lugar de: atar no es autorizar.
     Si no hay nadie esperando, no se da de alta a nadie (D-36). */
  if (correo) await vincularPorCorreo(sub, correo);

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
    const { sub, correo } = await identificarConCodigo(url, codigo);
    return entrar({ sub, correo, cookies, url, redirect });
  } catch {
    return redirect('/admin/entrar?motivo=error');
  }
}

export async function POST({ request, cookies, url, redirect }) {
  if (!haySimulado()) return new Response(null, { status: 404 });

  const formulario = await request.formData();

  /* Segundo camino simulado: entrar POR CORREO, como hará Llave CDMX.
     Existe para poder probar hoy la atadura del primer ingreso, que es la
     pieza que no se puede ensayar sin proveedor. Se inventa un identificador
     nuevo cada vez, igual que haría un proveedor con alguien que nunca ha
     entrado. */
  const correo = String(formulario.get('dev_correo') ?? '').trim();
  if (correo) {
    /* Un proveedor real devuelve siempre el mismo identificador para la misma
       persona. Se respeta aquí: si ya entró alguna vez, se reutiliza el suyo;
       si es su primera vez, se inventa uno, que es lo que hará Llave CDMX. */
    const sub = (await identificadorYaAtado(correo)) ?? `sim-${crypto.randomUUID()}`;
    return entrar({ sub, correo, cookies, url, redirect });
  }

  const sub = String(formulario.get('dev_sub') ?? '');

  // Aun en desarrollo, sólo se admiten los identificadores de prueba.
  if (!sub.startsWith('dev-')) return redirect('/admin/entrar?motivo=error');

  return entrar({ sub, cookies, url, redirect });
}
