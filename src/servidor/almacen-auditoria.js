/* Auditoría del almacén de fotografías.
 *
 * POR QUÉ EXISTE
 *
 * La base y el almacén son dos sistemas distintos que tienen que coincidir, y
 * R2 no participa de las transacciones de D1 (ver `fotografias.js`). Cuando
 * dos almacenes tienen que quedar de acuerdo y nada los compara, se separan en
 * silencio. Ya pasó: al revisar la base local aparecieron ocho archivos de un
 * ejemplar borrado antes de que existiera el código que retira imágenes.
 *
 * Nada avisaba. `verificar-estructura.sql` compara el esqueleto de las dos
 * bases; `migrations list` compara el registro de migraciones. Ninguno mira el
 * almacén.
 *
 * LOS DOS DESAJUSTES NO SON IGUALES
 *
 *   · ROTO — la base apunta a un archivo que no existe. Se ve: la ficha
 *     pública muestra una imagen rota. Es el grave, y no se puede arreglar
 *     solo: o se vuelve a subir la fotografía, o se retira el renglón. Eso lo
 *     decide una persona.
 *
 *   · SUELTO — un archivo que nadie apunta. No se ve, y se paga: R2 cobra por
 *     almacenamiento. Éste sí se puede limpiar sin pensarlo, porque por
 *     definición ningún renglón lo usa.
 *
 * POR QUÉ ES UNA PANTALLA Y NO UN GUION DE TERMINAL
 *
 * La comprobación necesita leer el almacén, y el almacén sólo se alcanza desde
 * donde corre la aplicación: `wrangler` no tiene un comando que liste objetos
 * de R2. Siendo pantalla, además, funciona igual contra la base local y contra
 * la de producción, sin credenciales ni comandos distintos. Es justo lo que le
 * faltó a la verificación de estructura, que contra la remota no se puede
 * correr desde que el endpoint de consultas dejó de aceptar el token.
 */
import { obtenerBase } from './base-de-datos.js';
import { listarClaves, retirarClaves } from './fotografias.js';

const CAMPOS = ['clave_original', 'clave_ficha', 'clave_tarjeta', 'clave_miniatura'];

/**
 * Cruza la base con el almacén, en los dos sentidos.
 *
 * Devuelve siempre la misma forma, aunque no haya nada que reportar, para que
 * la pantalla no tenga que defenderse de campos ausentes.
 */
export async function auditarAlmacen() {
  const { results: renglones } = await obtenerBase()
    .prepare(
      `SELECT f.id, f.ejemplar_id, f.orden,
              f.clave_original, f.clave_ficha, f.clave_tarjeta, f.clave_miniatura,
              e.nombre, e.slug, e.centro_origen_clave, e.folio_interno, e.es_ficticio
         FROM fotografia f
         JOIN ejemplar e ON e.id = f.ejemplar_id
        ORDER BY f.ejemplar_id, f.orden`
    )
    .all();

  /* Las fotografías de muestra de los datos ficticios viven en `public/` y su
     clave es una ruta absoluta que empieza con «/». No están en el almacén y
     no deben contarse como rotas. Cuando se retiren los datos ficticios esta
     rama simplemente dejará de entrar. */
  const referencias = new Map();          // clave → { foto, campo }
  for (const f of renglones) {
    for (const campo of CAMPOS) {
      const clave = f[campo];
      if (clave && !String(clave).startsWith('/')) referencias.set(clave, { foto: f, campo });
    }
  }

  const objetos = await listarClaves();
  const enAlmacen = new Map(objetos.map((o) => [o.clave, o]));

  /* ROTOS: agrupados por ejemplar. A quien tiene que resolverlo no le sirve
     una lista de claves; le sirve saber a qué animal le falta la imagen. */
  const porEjemplar = new Map();
  for (const [clave, { foto, campo }] of referencias) {
    if (enAlmacen.has(clave)) continue;
    if (!porEjemplar.has(foto.ejemplar_id)) {
      porEjemplar.set(foto.ejemplar_id, {
        ejemplar_id: foto.ejemplar_id,
        nombre: foto.nombre,
        slug: foto.slug,
        centro: foto.centro_origen_clave,
        folio: foto.folio_interno,
        es_ficticio: foto.es_ficticio,
        claves: [],
      });
    }
    porEjemplar.get(foto.ejemplar_id).claves.push({ clave, campo, orden: foto.orden });
  }

  const sueltos = objetos
    .filter((o) => !referencias.has(o.clave))
    .sort((a, b) => a.clave.localeCompare(b.clave));

  return {
    referencias: referencias.size,
    objetos: objetos.length,
    rotos: [...porEjemplar.values()].sort((a, b) => a.ejemplar_id - b.ejemplar_id),
    sueltos,
    bytesSueltos: sueltos.reduce((suma, o) => suma + (o.bytes ?? 0), 0),
  };
}

/** Sólo la administración global retira archivos del almacén.
 *
 *  El filtro de `middleware.js` ya impide llegar a esta pantalla sin ese
 *  perfil, y aun así la regla se repite aquí. Una regla que vive en una sola
 *  puerta deja de valer en cuanto alguien abre otra: basta que una pantalla
 *  futura, un punto de acceso o una tarea programada llamen a esta función
 *  para que el único control desaparezca sin que nadie lo note. La
 *  administración del personal hace lo mismo por la misma razón. */
export function puedeAdministrarAlmacen(persona) {
  return persona?.rol === 'ADMIN_GLOBAL';
}

/**
 * Retira los archivos sueltos y deja constancia.
 *
 * Vuelve a auditar antes de borrar en lugar de fiarse de la lista que trae la
 * pantalla. La pantalla pudo haberse cargado hace media hora, y en ese rato
 * alguien pudo subir una fotografía cuya clave estuviera en esa lista vieja:
 * se borraría un archivo que ya tiene dueño. Es el mismo razonamiento por el
 * que el alta comprueba el folio al guardar y no sólo al escribirlo.
 *
 * La constancia guarda la lista completa de claves en la columna `respaldo`.
 * Un borrado sin registro de qué se borró no se puede investigar después.
 */
export async function retirarSueltos(persona, confirmacion, ip) {
  /* La autorización va antes que la validación del formulario: a quien no
     tiene permiso no se le explica qué habría tenido que escribir. */
  if (!puedeAdministrarAlmacen(persona)) {
    return { error: 'No tienes permiso para retirar archivos del almacén.' };
  }

  if (String(confirmacion ?? '').trim().toUpperCase() !== 'RETIRAR') {
    return { error: 'Para retirar los archivos hay que escribir RETIRAR.' };
  }

  const { sueltos } = await auditarAlmacen();
  if (sueltos.length === 0) {
    return { aviso: 'No quedaba ningún archivo suelto.' };
  }

  const claves = sueltos.map((o) => o.clave);
  const cuantos = await retirarClaves(claves);

  await obtenerBase()
    .prepare(
      `INSERT INTO bitacora
         (entidad, entidad_id, accion, campo, valor_anterior, usuario_id, ocurrido_en, ip, respaldo)
       VALUES ('FOTOGRAFIA', 0, 'BAJA', 'archivos sueltos', ?, ?, ?, ?, ?)`
    )
    .bind(
      `${cuantos} archivos sin renglón que los apuntara`,
      persona?.id ?? null,
      new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      ip ?? null,
      claves.join('\n')
    )
    .run();

  return {
    aviso: cuantos === 1
      ? 'Se retiró 1 archivo suelto.'
      : `Se retiraron ${cuantos} archivos sueltos.`,
  };
}
