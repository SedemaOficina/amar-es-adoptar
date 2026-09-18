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

  /* La persona se deja disponible ANTES del filtro de abajo, no después.
     Aunque el filtro corte el paso, la pantalla de «no encontrado» es una
     pantalla de la administración y necesita saber quién la está viendo para
     pintar su encabezado y su menú. */
  contexto.locals.persona = persona;

  /* La administración del personal y el estado del almacén son sólo de la
     administración global: una dice quién entra al sistema, la otra puede
     retirar archivos. Responde «no existe» y no «no puedes»: un capturista no
     tiene por qué enterarse de que esas pantallas están ahí.

     Se reescribe en lugar de devolver un 404 pelón. `rewrite` conserva la
     dirección que la persona escribió y pinta en su lugar la página de no
     encontrado de la administración, que sí tiene encabezado y menú. Antes
     esto respondía una pantalla en blanco: correcto de fondo y desconcertante
     de forma (C-11). */
  const SOLO_ADMIN_GLOBAL = ['/admin/personal', '/admin/almacen'];
  if (SOLO_ADMIN_GLOBAL.some((r) => ruta.startsWith(r)) && persona.rol !== 'ADMIN_GLOBAL') {
    return contexto.rewrite('/admin/no-encontrado');
  }

  return next();
}
