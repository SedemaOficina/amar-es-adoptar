/* Fotografías de los ejemplares.
 *
 * Los archivos viven en R2 y sus rutas en la tabla `fotografia`. Ninguna de
 * las dos cosas sirve sin la otra, así que todo lo que las toca pasa por aquí.
 *
 * DÓNDE SE REDIMENSIONA Y POR QUÉ
 *
 * Los cuatro tamaños los genera el navegador de quien sube la foto, no el
 * servidor. Razones:
 *
 *   · No agrega ninguna dependencia. Redimensionar en el servidor exigiría una
 *     biblioteca de imágenes compilada a WebAssembly, con su peso y su
 *     mantenimiento, para algo que el navegador ya sabe hacer.
 *   · Lo que viaja por la red es lo ya reducido. El personal de los centros
 *     sube desde donde puede; mandar cuatro archivos pequeños en lugar de una
 *     fotografía de teléfono de cuatro megas se nota.
 *   · Quien sube ve el recorte antes de guardarlo.
 *
 * Lo que se sacrifica: depende de que el navegador ejecute JavaScript, y el
 * servidor no puede rehacer los tamaños por su cuenta. Por eso se guarda
 * también una copia maestra de 1600×1200: si algún día hay que regenerar los
 * derivados, el material está.
 *
 * El servidor no se fía: comprueba tipo, tamaño y número de archivos.
 */
import { env } from 'cloudflare:workers';
import { obtenerBase } from './base-de-datos.js';

/* El máximo y los cuatro tamaños viven en `compartido/` porque el navegador
   también los necesita y no puede importar este archivo. Se vuelven a
   exportar aquí para que todo lo que ya los pedía a este módulo siga
   funcionando sin cambios. */
export { MAXIMO_POR_EJEMPLAR, TAMANOS } from '../compartido/fotografias-medidas.js';
import { MAXIMO_POR_EJEMPLAR, TAMANOS } from '../compartido/fotografias-medidas.js';

const BYTES_MAXIMOS = 3 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/webp'];

function almacen() {
  const r2 = env?.FOTOS;
  if (!r2) {
    throw new Error(
      'No hay enlace con el almacén de fotografías. Revisa "r2_buckets" en wrangler.jsonc.'
    );
  }
  return r2;
}

/** Ruta del archivo dentro del almacén. */
function ruta(ejemplarId, orden, tamano, sello) {
  return `ejemplar/${ejemplarId}/${orden}-${tamano}-${sello}.jpg`;
}

/**
 * Dirección web de una fotografía a partir de su clave guardada.
 *
 * Conviven dos orígenes y hay que distinguirlos:
 *   · Las fotografías reales viven en R2 y su clave es relativa
 *     ("ejemplar/12/1-tarjeta-abc.jpg"): las sirve /fotos/…
 *   · Las imágenes de muestra de los datos ficticios viven en public/ y su
 *     clave ya es una ruta absoluta ("/imagenes/muestra/muestra-05.svg"):
 *     se usan tal cual.
 *
 * Cuando se retiren los datos ficticios esta función seguirá siendo correcta;
 * simplemente dejará de entrar por la primera rama.
 */
export function urlFoto(clave) {
  if (!clave) return '/imagenes/sin-foto.svg';
  return clave.startsWith('/') ? clave : `/fotos/${clave}`;
}

export async function listar(ejemplarId) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT id, orden, clave_original, clave_ficha, clave_tarjeta, clave_miniatura,
              texto_alternativo, ancho, alto, bytes
         FROM fotografia WHERE ejemplar_id = ? ORDER BY orden`
    )
    .bind(ejemplarId)
    .all();
  return results;
}

/**
 * Guarda una fotografía con sus cuatro tamaños.
 * @param archivos Map de nombre de tamaño → File
 */
export async function guardar(ejemplar, archivos, textoAlternativo) {
  const existentes = await listar(ejemplar.id);
  if (existentes.length >= MAXIMO_POR_EJEMPLAR) {
    return { error: `Un ejemplar admite ${MAXIMO_POR_EJEMPLAR} fotografías como máximo.` };
  }

  // Comprobaciones del servidor: el navegador ya validó, pero se puede saltar.
  for (const { nombre } of TAMANOS) {
    const archivo = archivos.get(nombre);
    if (!archivo || typeof archivo === 'string') {
      return { error: 'Faltó alguno de los tamaños. Vuelve a intentarlo.' };
    }
    if (!TIPOS.includes(archivo.type)) {
      return { error: 'El archivo debe ser una imagen JPEG.' };
    }
    if (archivo.size > BYTES_MAXIMOS) {
      return { error: 'Alguna de las imágenes pesa más de lo admitido.' };
    }
  }

  const r2 = almacen();
  const orden = (existentes.at(-1)?.orden ?? 0) + 1;
  const sello = Date.now().toString(36);
  const claves = {};

  // Se suben primero los archivos; si algo falla, no queda un renglón
  // apuntando a una fotografía que no existe.
  for (const { nombre } of TAMANOS) {
    const archivo = archivos.get(nombre);
    const clave = ruta(ejemplar.id, orden, nombre, sello);
    await r2.put(clave, await archivo.arrayBuffer(), {
      httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' },
    });
    claves[nombre] = clave;
  }

  const alterno = (textoAlternativo ?? '').trim()
    || `Fotografía de ${ejemplar.nombre}`;

  await obtenerBase()
    .prepare(
      `INSERT INTO fotografia
         (ejemplar_id, orden, clave_original, clave_ficha, clave_tarjeta, clave_miniatura,
          texto_alternativo, ancho, alto, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      ejemplar.id, orden, claves.original, claves.ficha, claves.tarjeta, claves.miniatura,
      alterno, 1600, 1200, archivos.get('original').size
    )
    .run();

  return { orden };
}

/**
 * Traduce un formulario en la acción que corresponda.
 *
 * Existe para que las TRES entradas —la página de fotografías, la ruta
 * parcial que usa la ficha, y cualquiera que venga después— hagan lo mismo
 * ante el mismo formulario. Antes esto estaba copiado en cada página, que es
 * exactamente como una acaba comportándose distinto de la otra sin que nadie
 * lo note.
 *
 * Nunca lanza: devuelve `{ aviso }` o `{ error }`, siempre con texto que la
 * capturista pueda leer. El detalle técnico va al registro del servidor.
 */
export async function aplicarAccion(ejemplar, datos) {
  const accion = String(datos.get('accion') ?? '');

  try {
    if (accion === 'subir') {
      const archivos = new Map(TAMANOS.map((t) => [t.nombre, datos.get(t.nombre)]));
      const r = await guardar(ejemplar, archivos, String(datos.get('texto_alternativo') ?? ''));
      return r.error ? { error: r.error } : { aviso: 'Fotografía guardada.' };
    }

    if (accion === 'eliminar') {
      const r = await eliminar(ejemplar.id, Number(datos.get('fotografia_id')));
      return r.error ? { error: r.error } : { aviso: 'Fotografía retirada.' };
    }

    if (accion === 'subir-orden' || accion === 'bajar-orden') {
      const r = await mover(ejemplar.id, datos.get('fotografia_id'),
        accion === 'subir-orden' ? 'subir' : 'bajar');
      return r.error ? { error: r.error } : { aviso: 'Orden actualizado.' };
    }

    return { error: 'Acción no reconocida.' };
  } catch (e) {
    console.error('[fotografias] acción', accion, e);
    return { error: 'No se pudo completar la operación. Inténtalo de nuevo.' };
  }
}

/**
 * Quita una fotografía y sus cuatro archivos, y recorre el orden.
 *
 * No deja al ejemplar sin ninguna: la regla del programa es que ningún animal
 * se registra ni se publica sin imagen, y borrar la última la rompería por la
 * puerta de atrás. Para sustituir una fotografía se sube primero la nueva y
 * luego se retira la vieja.
 */
export async function eliminar(ejemplarId, fotografiaId) {
  const db = obtenerBase();

  const foto = await db
    .prepare(`SELECT * FROM fotografia WHERE id = ? AND ejemplar_id = ?`)
    .bind(fotografiaId, ejemplarId)
    .first();

  if (!foto) return { error: 'Esa fotografía no existe.' };

  const todas = await listar(ejemplarId);
  if (todas.length <= 1) {
    return {
      error: 'Es la única fotografía del ejemplar. Sube primero la que la sustituye y luego retira ésta.',
    };
  }

  const r2 = almacen();
  await r2.delete([foto.clave_original, foto.clave_ficha, foto.clave_tarjeta, foto.clave_miniatura]);

  await db.prepare(`DELETE FROM fotografia WHERE id = ?`).bind(fotografiaId).run();

  // El orden no debe quedar con huecos: la 1 es siempre la portada.
  const quedan = await listar(ejemplarId);
  const renumerar = quedan
    .map((f, i) => (f.orden === i + 1 ? null : db
      .prepare(`UPDATE fotografia SET orden = ? WHERE id = ?`).bind(i + 1, f.id)))
    .filter(Boolean);
  if (renumerar.length) await db.batch(renumerar);

  return { ok: true };
}

/** Sube o baja una fotografía en el orden. La primera es la portada. */
export async function mover(ejemplarId, fotografiaId, direccion) {
  const db = obtenerBase();
  const fotos = await listar(ejemplarId);

  const i = fotos.findIndex((f) => f.id === Number(fotografiaId));
  const j = direccion === 'subir' ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= fotos.length) return { error: 'No se puede mover más.' };

  /* El intercambio va en tres pasos, no en dos.
     UNIQUE (ejemplar_id, orden) impide que dos fotografías compartan posición
     ni por un instante, y SQLite comprueba la unicidad después de cada
     sentencia. Así que primero se aparta una de ellas a una posición negativa
     —transitoria, permitida por la migración 0003— y luego se colocan las dos
     definitivas. batch() es una sola transacción: o pasan las tres o ninguna,
     de modo que nunca queda un registro con orden negativo. */
  const ordenI = fotos[i].orden;
  const ordenJ = fotos[j].orden;

  await db.batch([
    db.prepare(`UPDATE fotografia SET orden = ? WHERE id = ?`).bind(-ordenI, fotos[i].id),
    db.prepare(`UPDATE fotografia SET orden = ? WHERE id = ?`).bind(ordenI, fotos[j].id),
    db.prepare(`UPDATE fotografia SET orden = ? WHERE id = ?`).bind(ordenJ, fotos[i].id),
  ]);

  return { ok: true };
}

/**
 * Retira del almacén los archivos de una lista de fotografías.
 *
 * Se usa al borrar un ejemplar. Si se borrara el registro sin esto, los
 * archivos quedarían en R2 para siempre y sin nadie que supiera de quién
 * eran: basura que se paga y no se puede limpiar.
 *
 * Las claves absolutas se saltan: son las imágenes de muestra de los datos
 * ficticios, que viven en public/ y no en el almacén.
 */
export async function retirarArchivos(fotos) {
  const claves = (fotos ?? [])
    .flatMap((f) => [f.clave_original, f.clave_ficha, f.clave_tarjeta, f.clave_miniatura])
    .filter((c) => c && !String(c).startsWith('/'));

  if (claves.length === 0) return 0;
  await almacen().delete(claves);
  return claves.length;
}

/** Entrega un archivo del almacén. Lo usa la ruta pública /fotos/… */
export async function leer(clave) {
  return almacen().get(clave);
}

/**
 * Todas las claves del almacén, con su tamaño.
 *
 * R2 entrega como máximo mil objetos por llamada y avisa con `truncated` si
 * hay más, así que hay que pedir en tandas hasta agotarlas. Con el padrón
 * cargado —unos mil ejemplares por cuatro archivos por fotografía— serán
 * varios miles: si esto leyera una sola tanda, la auditoría reportaría como
 * huérfano todo lo que quedara fuera, que es la peor forma de fallar.
 *
 * Sólo lo usa la auditoría del almacén. El resto del sistema lee cada
 * fotografía por su clave exacta, nunca listando.
 */
export async function listarClaves() {
  const r2 = almacen();
  const todas = [];
  let cursor;

  do {
    const tanda = await r2.list({ limit: 1000, cursor });
    for (const objeto of tanda.objects) {
      todas.push({ clave: objeto.key, bytes: objeto.size, subido: objeto.uploaded });
    }
    cursor = tanda.truncated ? tanda.cursor : undefined;
  } while (cursor);

  return todas;
}

/**
 * Retira claves sueltas del almacén.
 *
 * Distinta de `retirarArchivos`, que recibe renglones de la tabla. Ésta recibe
 * claves a secas porque su caso de uso es justamente el contrario: archivos
 * que NO tienen renglón. Sólo la llama la auditoría del almacén.
 *
 * R2 admite hasta mil claves por borrado, así que también va por tandas.
 */
export async function retirarClaves(claves) {
  const limpias = (claves ?? []).filter((c) => c && !String(c).startsWith('/'));
  if (limpias.length === 0) return 0;

  const r2 = almacen();
  for (let i = 0; i < limpias.length; i += 1000) {
    await r2.delete(limpias.slice(i, i + 1000));
  }
  return limpias.length;
}
