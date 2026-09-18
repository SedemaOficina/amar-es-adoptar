/* Medidas de las fotografías: lo único que el servidor y el navegador tienen
 * que saber igual.
 *
 * POR QUÉ ESTÁ EN SU PROPIO ARCHIVO
 * ---------------------------------
 * `servidor/fotografias.js` no se puede importar desde el navegador: su
 * primera línea trae `cloudflare:workers`, que sólo existe en el servidor.
 * Si estas dos constantes se quedaran allá, la única manera de pasárselas al
 * navegador sería copiarlas en el HTML de cada página, y dos copias de una
 * medida acaban siempre en una discrepancia: el navegador recorta a 480 px,
 * el servidor espera 512 y rechaza el archivo sin decir por qué.
 *
 * Aquí no hay nada de Cloudflare ni de base de datos, así que lo importan los
 * dos lados y hay una sola verdad.
 */

/** Cuántas fotografías admite un ejemplar. */
export const MAXIMO_POR_EJEMPLAR = 3;

/** Los cuatro tamaños, todos en proporción 4:3 con encuadre superior. */
export const TAMANOS = [
  { nombre: 'original',  ancho: 1600, alto: 1200, calidad: 0.82 },
  { nombre: 'ficha',     ancho: 960,  alto: 720,  calidad: 0.82 },
  { nombre: 'tarjeta',   ancho: 480,  alto: 360,  calidad: 0.80 },
  { nombre: 'miniatura', ancho: 320,  alto: 240,  calidad: 0.78 },
];
