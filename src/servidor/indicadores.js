/* Indicadores de operación.
 *
 * QUÉ PREGUNTA RESPONDE ESTE TABLERO
 *
 * «¿Qué tengo hoy y qué me falta atender?» No es un reporte de periodo: es la
 * pantalla que alguien abre el lunes para decidir en qué trabajar. Por eso
 * cada número tiene, al lado, la lista de los casos concretos que lo componen.
 * Un indicador que no se puede accionar es adorno.
 *
 * ALCANCE
 *
 * La misma regla que rige el catálogo y las solicitudes: el capturista ve su
 * centro, la Oficina de la Secretaría ve todo y puede desglosar por centro.
 * El alcance lo impone el servidor, no la pantalla.
 */
import { obtenerBase } from './base-de-datos.js';

const NO_RESUELTAS = ['RECIBIDA', 'EN_REVISION', 'CONTACTADA'];

/** Condición del ejemplar: qué filtro aplica según el perfil. */
function limiteEjemplar(persona) {
  return persona.rol === 'CAPTURISTA'
    ? { sql: 'e.centro_actual_clave = ?', valores: [persona.centro_clave] }
    : { sql: null, valores: [] };
}

/* Para las solicitudes el centro es el del ejemplar vivo; si el ejemplar ya no
   existe, el de la instantánea. Igual que en solicitudes-admin.js. */
function limiteSolicitud(persona) {
  return persona.rol === 'CAPTURISTA'
    ? {
        sql: 'COALESCE(e.centro_actual_clave, s.snap_centro_actual) = ?',
        valores: [persona.centro_clave],
      }
    : { sql: null, valores: [] };
}

const donde = (limite, extra = []) => {
  const partes = [...(limite.sql ? [limite.sql] : []), ...extra];
  return partes.length ? `WHERE ${partes.join(' AND ')}` : '';
};

/**
 * Reparto de ejemplares por una columna de catálogo.
 * Devuelve TODAS las claves del catálogo, incluidas las que están en cero:
 * un cero es información —«no tenemos ni un ejemplar chico»— y omitirlo hace
 * creer que la categoría no existe.
 */
async function repartoEjemplares(persona, columna, tabla) {
  const limite = limiteEjemplar(persona);
  const { results } = await obtenerBase()
    .prepare(
      `SELECT c.clave, c.etiqueta,
              (SELECT COUNT(*) FROM ejemplar e
                ${donde(limite, [`e.${columna} = c.clave`])}) AS cuantos
         FROM ${tabla} c
        WHERE c.activo = 1
        ORDER BY c.orden`
    )
    .bind(...limite.valores)
    .all();
  return results;
}

/** Reparto por una columna que no es catálogo sino lista fija del esquema. */
async function repartoFijo(persona, columna, claves) {
  const limite = limiteEjemplar(persona);
  const db = obtenerBase();
  const filas = [];
  for (const { clave, etiqueta, tono } of claves) {
    const { cuantos } = await db
      .prepare(`SELECT COUNT(*) AS cuantos FROM ejemplar e ${donde(limite, [`e.${columna} = ?`])}`)
      .bind(...limite.valores, clave)
      .first();
    filas.push({ clave, etiqueta, tono, cuantos });
  }
  return filas;
}

export const CONDICIONES = [
  { clave: 'DISPONIBLE', etiqueta: 'Disponible', tono: 'exito' },
  { clave: 'EN_PROCESO', etiqueta: 'En proceso', tono: 'atencion' },
  { clave: 'ADOPTADO',   etiqueta: 'Adoptado',   tono: 'inactivo' },
  { clave: 'BAJA',       etiqueta: 'Baja',       tono: 'inactivo' },
];

/* SIN USO desde D-118: al programa sólo ingresan ejemplares en verde, así que
   la gráfica de semáforo quedaba con una sola rebanada y dejó de informar. Se
   conserva la lista, no la gráfica: si alguna vez hay que contar cuántos
   quedan en amarillo —los que pudiera traer la carga inicial—, el reparto se
   arma con esto y no hay que reinventarlo. */
export const SEMAFOROS = [
  { clave: 'VERDE',    etiqueta: 'Verde',    tono: 'exito' },
  { clave: 'AMARILLO', etiqueta: 'Amarillo', tono: 'atencion' },
];

export const ESTADOS_SOLICITUD = [
  { clave: 'RECIBIDA',    etiqueta: 'Recibida',    tono: 'alto' },
  { clave: 'EN_REVISION', etiqueta: 'En revisión', tono: 'atencion' },
  { clave: 'CONTACTADA',  etiqueta: 'Contactada',  tono: 'atencion' },
  { clave: 'APROBADA',    etiqueta: 'Aprobada',    tono: 'exito' },
  { clave: 'RECHAZADA',   etiqueta: 'Rechazada',   tono: 'inactivo' },
  { clave: 'CONCLUIDA',   etiqueta: 'Concluida',   tono: 'inactivo' },
];

export async function obtenerIndicadores(persona) {
  const db = obtenerBase();
  const le = limiteEjemplar(persona);
  const ls = limiteSolicitud(persona);

  // --- Los cuatro números de cabecera -----------------------------------
  const { total } = await db
    .prepare(`SELECT COUNT(*) AS total FROM ejemplar e ${donde(le)}`)
    .bind(...le.valores).first();

  const { disponibles } = await db
    .prepare(`SELECT COUNT(*) AS disponibles FROM ejemplar e ${donde(le, ["e.condicion = 'DISPONIBLE'"])}`)
    .bind(...le.valores).first();

  const { sinFoto } = await db
    .prepare(
      `SELECT COUNT(*) AS sinFoto FROM ejemplar e
        ${donde(le, ['NOT EXISTS (SELECT 1 FROM fotografia f WHERE f.ejemplar_id = e.id)',
                     "e.condicion <> 'ADOPTADO'"])}`
    )
    .bind(...le.valores).first();

  const { sinResolver } = await db
    .prepare(
      `SELECT COUNT(*) AS sinResolver
         FROM solicitud s LEFT JOIN ejemplar e ON e.id = s.ejemplar_id
        ${donde(ls, [`s.estado IN (${NO_RESUELTAS.map(() => '?').join(',')})`])}`
    )
    .bind(...ls.valores, ...NO_RESUELTAS).first();

  // --- Repartos ----------------------------------------------------------
  const [sexo, edad, talla] = await Promise.all([
    repartoEjemplares(persona, 'sexo_clave', 'sexo'),
    repartoEjemplares(persona, 'edad_clave', 'edad'),
    repartoEjemplares(persona, 'talla_clave', 'talla'),
  ]);

  const condicion = await repartoFijo(persona, 'condicion', CONDICIONES);

  const { results: porEstado } = await db
    .prepare(
      `SELECT s.estado, COUNT(*) AS cuantos
         FROM solicitud s LEFT JOIN ejemplar e ON e.id = s.ejemplar_id
        ${donde(ls)} GROUP BY s.estado`
    )
    .bind(...ls.valores).all();

  const solicitudes = ESTADOS_SOLICITUD.map((e) => ({
    ...e,
    cuantos: porEstado.find((p) => p.estado === e.clave)?.cuantos ?? 0,
  }));

  // Sólo la Oficina desglosa por centro; al capturista no le dice nada.
  const { results: porCentro } = persona.rol === 'CAPTURISTA'
    ? { results: [] }
    : await db.prepare(
        `SELECT c.clave, c.etiqueta,
                (SELECT COUNT(*) FROM ejemplar e WHERE e.centro_actual_clave = c.clave) AS cuantos,
                (SELECT COUNT(*) FROM ejemplar e
                  WHERE e.centro_actual_clave = c.clave AND e.condicion = 'DISPONIBLE') AS disponibles
           FROM centro c WHERE c.activo = 1 ORDER BY c.orden`
      ).all();

  // --- Lo que hay que atender, con nombre y apellido ---------------------
  const { results: faltanFotos } = await db
    .prepare(
      `SELECT e.slug, e.nombre, e.folio_interno, e.centro_actual_clave, e.creado_en
         FROM ejemplar e
        ${donde(le, ['NOT EXISTS (SELECT 1 FROM fotografia f WHERE f.ejemplar_id = e.id)',
                     "e.condicion <> 'ADOPTADO'"])}
        ORDER BY e.creado_en LIMIT 6`
    )
    .bind(...le.valores).all();

  const { results: esperando } = await db
    .prepare(
      `SELECT s.folio, s.recibida_en, s.estado, s.snap_nombre,
              s.nombres, s.primer_apellido
         FROM solicitud s LEFT JOIN ejemplar e ON e.id = s.ejemplar_id
        ${donde(ls, [`s.estado IN (${NO_RESUELTAS.map(() => '?').join(',')})`])}
        ORDER BY s.recibida_en LIMIT 6`
    )
    .bind(...ls.valores, ...NO_RESUELTAS).all();

  const { results: masTiempo } = await db
    .prepare(
      `SELECT e.slug, e.nombre, e.folio_interno, e.creado_en,
              (SELECT COUNT(*) FROM solicitud so WHERE so.ejemplar_id = e.id) AS solicitudes
         FROM ejemplar e
        ${donde(le, ["e.condicion = 'DISPONIBLE'"])}
        ORDER BY e.creado_en LIMIT 6`
    )
    .bind(...le.valores).all();

  return {
    cabecera: { total, disponibles, sinFoto, sinResolver },
    repartos: { condicion, sexo, edad, talla },
    solicitudes,
    porCentro,
    pendientes: { faltanFotos, esperando, masTiempo },
  };
}
