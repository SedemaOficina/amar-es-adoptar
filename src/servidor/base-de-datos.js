/* Acceso a la base de datos desde las páginas que se generan en el servidor.
 *
 * ÚNICO PUNTO DEL PROYECTO QUE SABE CÓMO SE ALCANZA LA BASE.
 *
 * Existe por dos razones:
 *
 *   1. La forma de llegar a los enlaces del Worker ha cambiado entre
 *      versiones de Astro. Teniéndolo aquí, una actualización futura se
 *      corrige en un archivo y no en cada página.
 *
 *   2. Para la entrega a ADIP: si el sistema se aloja fuera de Cloudflare,
 *      éste es el archivo que se sustituye. El resto del código pide la base
 *      con obtenerBase() y no sabe de dónde sale.
 *
 * Sólo debe importarse desde páginas con `export const prerender = false`.
 * Las páginas estáticas no tienen servidor y no pueden usarlo.
 */
import { env } from 'cloudflare:workers';

export function obtenerBase() {
  const base = env?.DB;

  if (!base) {
    throw new Error(
      'No hay enlace con la base de datos. Revisa que "d1_databases" en ' +
      'wrangler.jsonc declare el enlace DB, y que el servidor se haya ' +
      'levantado después de ese cambio.'
    );
  }

  return base;
}
