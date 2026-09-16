/* Cierre de sesión. Borra la cookie y devuelve a la pantalla de acceso. */
export const prerender = false;

import { cerrarSesion } from '../../servidor/sesion.js';

export function GET({ cookies, redirect }) {
  cerrarSesion(cookies);
  return redirect('/admin/entrar');
}

export function POST({ cookies, redirect }) {
  cerrarSesion(cookies);
  return redirect('/admin/entrar');
}
