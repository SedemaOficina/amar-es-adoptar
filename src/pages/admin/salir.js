/* Cierre de sesión. Borra la cookie y devuelve a la pantalla de acceso. */
export const prerender = false;

import { cerrarSesion } from '../../servidor/sesion.js';

/* Sólo POST. Con GET, cualquier sitio ajeno cierra la sesión de quien esté
   trabajando con sólo incrustar una imagen que apunte aquí. */
export function POST({ cookies, redirect }) {
  cerrarSesion(cookies);
  return redirect('/admin/entrar');
}
