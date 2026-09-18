/* Fotografías, lado del navegador.
 *
 * Dos trabajos, y nada más que esos dos:
 *   1. Recortar la imagen que eligió la persona a los cuatro tamaños, antes
 *      de mandarla. Es lo que evita subir una foto de teléfono de cuatro
 *      megas por una conexión de centro.
 *   2. Mandar una acción al endpoint y devolver lo que conteste.
 *
 * Deliberadamente NO toca el DOM ni sabe cómo se ve nada: de eso se encarga
 * cada pantalla. Así este archivo sirve igual en la ficha y en la página de
 * fotografías, que lo pintan distinto.
 */
import { TAMANOS } from '../compartido/fotografias-medidas.js';

/* Recorta a la proporción pedida y devuelve un JPEG.
   Horizontal: se recorta a los lados, centrado.
   Vertical:   se recorta por abajo, conservando la parte de arriba, que es
               donde suele estar la cabeza del animal. Ese encuadre superior
               es la corrección al defecto de la plataforma de ADIP, que
               recorta al centro y decapita a los perros en fotos verticales. */
function recortar(imagen, ancho, alto, calidad) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const pincel = lienzo.getContext('2d');

  const proporcion = ancho / alto;
  let ox = 0, oy = 0, oancho = imagen.width, oalto = imagen.height;

  if (imagen.width / imagen.height > proporcion) {
    oancho = Math.round(imagen.height * proporcion);
    ox = Math.round((imagen.width - oancho) / 2);
  } else {
    oalto = Math.round(imagen.width / proporcion);
    oy = 0;
  }

  pincel.drawImage(imagen, ox, oy, oancho, oalto, 0, 0, ancho, alto);
  return new Promise((listo) => lienzo.toBlob(listo, 'image/jpeg', calidad));
}

/**
 * Prepara los cuatro tamaños de un archivo elegido por la persona.
 * @param {File} archivo
 * @returns {Promise<{blobs: Object, ancho: number, alto: number, bytes: number}>}
 * @throws si el archivo no se puede leer como imagen
 */
export async function prepararTamanos(archivo) {
  const imagen = await createImageBitmap(archivo);
  const ancho = imagen.width;
  const alto = imagen.height;

  const blobs = {};
  let bytes = 0;
  for (const t of TAMANOS) {
    blobs[t.nombre] = await recortar(imagen, t.ancho, t.alto, t.calidad);
    bytes += blobs[t.nombre].size;
  }
  imagen.close?.();

  return { blobs, ancho, alto, bytes };
}

/**
 * Manda una acción y devuelve el HTML con que conteste el servidor.
 *
 * Siempre responde con la misma forma, aunque se caiga la red:
 *   { ok: true,  html: '<div…' }
 *   { ok: false, error: 'texto para la persona' }
 *
 * Así quien la llama nunca tiene que envolverla en un try/catch para no
 * romperse, y nunca recibe `undefined` sin darse cuenta.
 *
 * @param {string} url     a dónde se manda: la ruta parcial o la página
 * @param {Object} campos  pares nombre/valor del formulario
 * @param {Object} [blobs] tamaños ya preparados, cuando la acción es 'subir'
 */
export async function enviarAccion(url, campos, blobs = null) {
  const cuerpo = new FormData();
  for (const [nombre, valor] of Object.entries(campos)) {
    cuerpo.append(nombre, valor);
  }
  if (blobs) {
    for (const t of TAMANOS) {
      cuerpo.append(t.nombre, blobs[t.nombre], `${t.nombre}.jpg`);
    }
  }

  try {
    const respuesta = await fetch(url, { method: 'POST', body: cuerpo });
    if (!respuesta.ok) {
      /* 401, 404, 500. El caso más probable en operación real es que la
         sesión haya vencido mientras la pantalla estaba abierta. */
      return { ok: false, error: 'No se pudo completar. Vuelve a cargar la página.' };
    }
    return { ok: true, html: await respuesta.text() };
  } catch {
    return { ok: false, error: 'Sin conexión. Revisa la red e inténtalo de nuevo.' };
  }
}

export { TAMANOS };
