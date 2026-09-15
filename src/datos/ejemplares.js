/* =====================================================================
   Acceso a los datos de ejemplares.
   
   ESTE ES EL ÚNICO PUNTO QUE CAMBIA EN LA ETAPA 3.
   Hoy lee el archivo de datos ficticios. Cuando exista la API, se
   sustituye el contenido de estas funciones por llamadas al servidor y
   ninguna página tiene que tocarse: todas consumen estas funciones y no
   el archivo directamente.
   ===================================================================== */

import datos from './ejemplares.json';

/** Catálogos de valores, para pintar los filtros con sus etiquetas. */
export const catalogos = datos.catalogos;

/** Verdadero mientras estemos trabajando con datos inventados. */
export const hayDatosFicticios = datos.es_ficticio === true;

/**
 * Ejemplares visibles al público.
 * Los ADOPTADO no se muestran: siguen existiendo en la base para
 * trazabilidad, pero salen del catálogo.
 */
export function obtenerEjemplares() {
  return datos.ejemplares.filter((e) => e.condicion !== 'ADOPTADO');
}

/** Un ejemplar por su identificador público. */
export function obtenerPorSlug(slug) {
  return obtenerEjemplares().find((e) => e.slug === slug);
}

/**
 * Traduce una clave de catálogo a la etiqueta que ve la persona usuaria.
 * Si la clave no existe devuelve la clave misma, para que un dato
 * inesperado no rompa la página: es uno de los errores del sistema actual.
 */
export function etiqueta(nombreCatalogo, clave) {
  const lista = catalogos[nombreCatalogo] || [];
  const valor = lista.find((v) => v.clave === clave);
  return valor ? valor.etiqueta : clave;
}

/** Fotografía de portada, o la imagen genérica si el ejemplar no tiene. */
export function portada(ejemplar) {
  const foto = (ejemplar.fotografias || []).find((f) => f.orden === 1);
  if (foto) return foto;
  return {
    orden: 1,
    archivo: '/imagenes/sin-foto.svg',
    texto_alternativo: `${ejemplar.nombre} todavía no tiene fotografía`,
  };
}
