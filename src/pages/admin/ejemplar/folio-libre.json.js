/* ¿Está libre este folio en este centro?
 *
 * PARA QUÉ EXISTE
 * ---------------
 * El alta exige fotografía, y el navegador vacía los campos de archivo cada
 * vez que la página se repinta con errores. Así que un folio repetido —el
 * error más común al capturar, porque el número viene del cuaderno del
 * centro— obligaba a volver a elegir la foto. Esta consulta permite avisarlo
 * ANTES de enviar, mientras se escribe.
 *
 * NO SUSTITUYE LA COMPROBACIÓN DEL SERVIDOR. `crearEjemplar` vuelve a revisar
 * el folio al guardar, y debe seguir haciéndolo: entre esta consulta y el
 * envío puede pasar un minuto, y en ese minuto otra persona de la misma
 * brigada pudo registrar ese número. Esto es comodidad; la regla vive allá.
 *
 * Devuelve JSON y no HTML porque quien lo consume es un pedazo de
 * JavaScript, no una pantalla.
 */
export const prerender = false;

import { folioOcupado, normalizarFolio } from '../../../servidor/ejemplar-escritura.js';

function respuesta(cuerpo) {
  return new Response(JSON.stringify(cuerpo), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET({ url, locals }) {
  const persona = locals.persona;

  /* Un capturista sólo pregunta por su propio centro, diga lo que diga la
     dirección. Es la misma regla que aplica el alta: si el centro lo pusiera
     quien consulta, esta ruta serviría para asomarse al padrón de los otros
     centros sin tener permiso de verlo. */
  const centro = persona.rol === 'CAPTURISTA'
    ? persona.centro_clave
    : url.searchParams.get('centro');

  const folio = normalizarFolio(url.searchParams.get('folio'));

  // Sin datos suficientes no se afirma nada: callar es mejor que adivinar.
  if (!folio || !centro) return respuesta({ estado: 'indefinido' });

  const nombre = await folioOcupado(centro, folio);
  return respuesta(
    nombre ? { estado: 'ocupado', folio, nombre } : { estado: 'libre', folio }
  );
}
