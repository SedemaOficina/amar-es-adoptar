/* Control de acceso a la administración.
 *
 * Se ejecuta antes de cada página. Deja pasar todo el portal público y filtra
 * lo que cuelga de /admin:
 *
 *   · Sin sesión válida → a la pantalla de acceso.
 *   · Con sesión pero sin registro activo en la tabla `usuario` → fuera, y se
 *     borra la cookie. Cubre el caso de alguien dado de baja que todavía
 *     conserva la cookie de una sesión abierta.
 *   · Con sesión y registro activo → se deja pasar y la persona queda
 *     disponible en Astro.locals.persona para que la página sepa quién es y
 *     de qué centro.
 */
const RUTAS_ABIERTAS = new Set(['/admin/entrar', '/admin/callback', '/admin/salir']);

export async function onRequest(contexto, next) {
  const ruta = contexto.url.pathname.replace(/\/+$/, '') || '/';

  const esAdministracion = ruta === '/admin' || ruta.startsWith('/admin/');
  if (!esAdministracion) return next();
  if (RUTAS_ABIERTAS.has(ruta)) return next();

  // Se cargan aquí y no arriba para que el portal público, que se genera al
  // construir, no arrastre código que sólo tiene sentido en el servidor.
  const { leerSesion, cerrarSesion } = await import('./servidor/sesion.js');
  const { obtenerPersonaActiva } = await import('./servidor/personal.js');

  const sub = await leerSesion(contexto.cookies);
  if (!sub) return contexto.redirect('/admin/entrar');

  const persona = await obtenerPersonaActiva(sub);
  if (!persona) {
    cerrarSesion(contexto.cookies);
    return contexto.redirect('/admin/entrar?motivo=sin-acceso');
  }

  contexto.locals.persona = persona;
  return next();
}
