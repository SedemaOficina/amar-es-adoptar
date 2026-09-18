/* Entrega las fotografías guardadas en el almacén.
 *
 * Es pública a propósito: son las fotos que ve la ciudadanía. Lo que sí se
 * comprueba es que la ruta pedida esté dentro del espacio de ejemplares, para
 * que nadie pueda pedir cualquier otra cosa del almacén escribiendo una
 * dirección a mano.
 */
export const prerender = false;

import { leer } from '../../servidor/fotografias.js';

export async function GET({ params }) {
  const clave = params.ruta ?? '';

  if (!clave.startsWith('ejemplar/') || clave.includes('..')) {
    return new Response(null, { status: 404 });
  }

  const objeto = await leer(clave);
  if (!objeto) return new Response(null, { status: 404 });

  const cabeceras = new Headers();
  objeto.writeHttpMetadata(cabeceras);
  cabeceras.set('etag', objeto.httpEtag);
  // Las rutas llevan un sello de tiempo, así que el archivo de una ruta dada
  // nunca cambia: se puede guardar en caché para siempre.
  cabeceras.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(objeto.body, { headers: cabeceras });
}
