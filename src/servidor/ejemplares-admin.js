/* Consultas del catálogo de administración.
 *
 * REGLA DE ALCANCE — lo más importante de este archivo:
 *
 * El centro NO es un filtro que la persona elige: para un capturista es un
 * límite que el servidor impone. Se aplica aquí, en la consulta, y no puede
 * saltarse cambiando la dirección del navegador. Un capturista de Ajusco que
 * escriba ?centro=GALEANA sigue viendo Ajusco.
 *
 * Esa distinción es la que corrige la tercera debilidad de la plataforma
 * vigente, donde un solo perfil podía verlo y borrarlo todo.
 */
import { obtenerBase } from './base-de-datos.js';

export const POR_PAGINA = 20;

const CONDICIONES = ['DISPONIBLE', 'EN_PROCESO', 'ADOPTADO', 'BAJA'];

/** Deja pasar sólo valores que existen; cualquier otra cosa se ignora. */
function limpiar(valor, admitidos) {
  return admitidos.includes(valor) ? valor : null;
}

/**
 * Busca ejemplares para la administración.
 *
 * @param persona  la que devuelve el filtro de acceso (Astro.locals.persona)
 * @param filtros  { centro, condicion, edad, sexo, talla, texto, pagina }
 * @param catalogos claves admitidas de cada catálogo, para validar
 */
/* Ordenamientos admitidos.
 *
 * Es una lista blanca, no texto que venga de la dirección: el ORDEN de un
 * SELECT no admite parámetros, así que si se concatenara lo que llegue por la
 * URL se abriría una inyección de SQL. Lo que no esté aquí se ignora y se cae
 * al orden por omisión.
 *
 * El orden por omisión es centro y folio —el orden en que el personal tiene
 * sus expedientes en papel—; los demás responden preguntas concretas.
 */
export const ORDENES = [
  { clave: 'folio',       etiqueta: 'Centro y folio' },
  { clave: 'nombre',      etiqueta: 'Nombre (A–Z)' },
  { clave: 'solicitudes', etiqueta: 'Más solicitudes primero' },
  { clave: 'condicion',   etiqueta: 'Condición: disponibles primero' },
  { clave: 'recientes',   etiqueta: 'Registrados más recientemente' },
  { clave: 'antiguos',    etiqueta: 'En adopción desde hace más tiempo' },
];

function ordenSQL(clave) {
  switch (clave) {
    case 'nombre':
      return 'LOWER(e.nombre), e.folio_interno';
    case 'solicitudes':
      // El desempate por folio evita que dos ejemplares con el mismo número de
      // solicitudes se intercambien de lugar entre una página y la siguiente.
      return 'solicitudes DESC, e.centro_actual_clave, e.folio_interno';
    case 'condicion':
      // No alfabético: el orden es el del ciclo de vida.
      return `CASE e.condicion WHEN 'DISPONIBLE' THEN 1 WHEN 'EN_PROCESO' THEN 2 ELSE 3 END,
              e.centro_actual_clave, e.folio_interno`;
    case 'recientes':
      return 'e.creado_en DESC, e.id DESC';
    case 'antiguos':
      return 'e.creado_en, e.id';
    default:
      return 'e.centro_actual_clave, e.folio_interno';
  }
}

export async function buscarEjemplares(persona, filtros, catalogos) {
  const db = obtenerBase();

  const donde = [];
  const valores = [];

  // --- Alcance, no filtro ---------------------------------------------
  if (persona.rol === 'CAPTURISTA') {
    donde.push('e.centro_actual_clave = ?');
    valores.push(persona.centro_clave);
  } else {
    const centro = limpiar(filtros.centro, catalogos.centro);
    if (centro) {
      donde.push('e.centro_actual_clave = ?');
      valores.push(centro);
    }
  }

  // --- Filtros que la persona sí elige --------------------------------
  const condicion = limpiar(filtros.condicion, CONDICIONES);
  if (condicion) { donde.push('e.condicion = ?'); valores.push(condicion); }

  const edad = limpiar(filtros.edad, catalogos.edad);
  if (edad) { donde.push('e.edad_clave = ?'); valores.push(edad); }

  const sexo = limpiar(filtros.sexo, catalogos.sexo);
  if (sexo) { donde.push('e.sexo_clave = ?'); valores.push(sexo); }

  const talla = limpiar(filtros.talla, catalogos.talla);
  if (talla) { donde.push('e.talla_clave = ?'); valores.push(talla); }

  // Busca por nombre o por folio interno, que es como opera el personal.
  const texto = (filtros.texto ?? '').trim();
  if (texto) {
    donde.push('(LOWER(e.nombre) LIKE LOWER(?) OR e.folio_interno LIKE ?)');
    valores.push(`%${texto}%`, `%${texto}%`);
  }

  const filtro = donde.length ? `WHERE ${donde.join(' AND ')}` : '';

  // --- Cuántos hay, para la paginación --------------------------------
  const { total } = await db
    .prepare(`SELECT COUNT(*) AS total FROM ejemplar e ${filtro}`)
    .bind(...valores)
    .first();

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number(filtros.pagina) || 1), paginas);
  const desde = (pagina - 1) * POR_PAGINA;

  // --- La página pedida ------------------------------------------------
  // La fotografía de portada se trae con una subconsulta para no duplicar
  // renglones cuando el ejemplar tiene dos o tres fotografías.
  const { results } = await db
    .prepare(
      `SELECT e.id, e.slug, e.nombre, e.folio_interno, e.condicion, e.semaforo,
              e.es_ficticio, e.actualizado_en,
              e.centro_actual_clave, e.centro_origen_clave,
              c.etiqueta AS centro_etiqueta,
              ed.etiqueta AS edad_etiqueta,
              sx.etiqueta AS sexo_etiqueta,
              tl.etiqueta AS talla_etiqueta,
              (SELECT f.clave_miniatura FROM fotografia f
                WHERE f.ejemplar_id = e.id ORDER BY f.orden LIMIT 1) AS miniatura,
              (SELECT COUNT(*) FROM fotografia f WHERE f.ejemplar_id = e.id) AS fotografias,
              -- Cuántas personas han solicitado a este ejemplar. Se cuentan
              -- todas, en cualquier estado: al centro le interesa el interés
              -- que despertó, no sólo el que sigue vivo.
              (SELECT COUNT(*) FROM solicitud so WHERE so.ejemplar_id = e.id) AS solicitudes
         FROM ejemplar e
         JOIN centro c  ON c.clave  = e.centro_actual_clave
         JOIN edad   ed ON ed.clave = e.edad_clave
         JOIN sexo   sx ON sx.clave = e.sexo_clave
         JOIN talla  tl ON tl.clave = e.talla_clave
         ${filtro}
        ORDER BY ${ordenSQL(filtros.orden)}
        LIMIT ? OFFSET ?`
    )
    .bind(...valores, POR_PAGINA, desde)
    .all();

  // El orden efectivo se devuelve ya saneado, para que la pantalla marque la
  // opción correcta en el desplegable y no lo que llegó por la dirección.
  const orden = ORDENES.some((o) => o.clave === filtros.orden) ? filtros.orden : 'folio';

  return { ejemplares: results, total, pagina, paginas, desde, orden };
}

/** Catálogos para pintar los desplegables de los filtros. */
export async function obtenerCatalogos() {
  const db = obtenerBase();
  const consulta = (tabla) =>
    db.prepare(`SELECT clave, etiqueta FROM ${tabla} WHERE activo = 1 ORDER BY orden`).all();

  const [centro, edad, sexo, talla] = await Promise.all([
    consulta('centro'), consulta('edad'), consulta('sexo'), consulta('talla'),
  ]);

  return {
    centro: centro.results,
    edad: edad.results,
    sexo: sexo.results,
    talla: talla.results,
  };
}

/** Sólo las claves, para validar lo que llega por la dirección. */
export function clavesDe(catalogos) {
  return {
    centro: catalogos.centro.map((v) => v.clave),
    edad: catalogos.edad.map((v) => v.clave),
    sexo: catalogos.sexo.map((v) => v.clave),
    talla: catalogos.talla.map((v) => v.clave),
  };
}

/** Resumen para la pantalla de inicio de la administración. */
export async function resumen(persona) {
  const db = obtenerBase();
  const soloSuCentro = persona.rol === 'CAPTURISTA';
  const filtro = soloSuCentro ? 'WHERE centro_actual_clave = ?' : '';
  const valores = soloSuCentro ? [persona.centro_clave] : [];

  const { results } = await db
    .prepare(`SELECT condicion, COUNT(*) AS n FROM ejemplar ${filtro} GROUP BY condicion`)
    .bind(...valores)
    .all();

  const porCondicion = Object.fromEntries(results.map((f) => [f.condicion, f.n]));

  return {
    disponibles: porCondicion.DISPONIBLE ?? 0,
    enProceso: porCondicion.EN_PROCESO ?? 0,
    adoptados: porCondicion.ADOPTADO ?? 0,
    total: results.reduce((s, f) => s + f.n, 0),
  };
}
