/* Consulta pública de ejemplares contra la base de datos.
 *
 * Esta es la única puerta por la que el portal público lee la base. Todo lo
 * que no se pida aquí, el portal no lo puede enseñar ni por descuido.
 *
 * Regla de la que cuelga el resto: el folio interno, el centro de origen, el
 * centro actual, el semáforo conductual y todo lo relativo a la baja de un
 * ejemplar —motivo, nota, fecha y persona que la ordenó— son datos de la
 * Secretaría. No salen de /admin (D-26, D-75, D-76).
 */
import { obtenerBase } from './base-de-datos.js';

/* Dos reglas distintas, y conviene no confundirlas.
 *
 * 1. Fuera del catálogo y de la ficha: adoptados y dados de baja. Ninguno de
 *    los dos sigue esperando hogar, así que mostrarlos sólo genera
 *    solicitudes que habría que rechazar.
 *
 * 2. Ni siquiera reconocibles: sólo los dados de baja. Que un ejemplar haya
 *    sido adoptado se puede decir —es la buena noticia del programa—; por qué
 *    se dio de baja, no, ni siquiera de forma indirecta. Así que ante un
 *    ejemplar dado de baja el portal responde lo mismo que ante una dirección
 *    inventada: no existe. Sin mensaje, sin nombre, sin fotografía.
 *
 * Están aquí, en un solo lugar, porque el catálogo, la ficha y la solicitud
 * tienen que responder igual. Si una pantalla dice «no existe» y otra enseña
 * el nombre, la diferencia entre las dos respuestas ya es la filtración. */
export const FUERA_DEL_CATALOGO = ['ADOPTADO', 'BAJA'];
export const NO_RECONOCIBLES = ['BAJA'];

/** Campos que sí puede ver la ciudadanía. Nada más. */
const CAMPOS_PUBLICOS = `
       e.slug, e.nombre, e.condicion,
       -- Cuándo entró al programa. Es público a propósito: es lo que permite
       -- decir «lleva tanto tiempo esperando», que es información a favor del
       -- ejemplar, no un dato interno de la Secretaría.
       e.creado_en,
       ed.etiqueta AS edad_etiqueta,
       sx.etiqueta AS sexo_etiqueta,
       tl.etiqueta AS talla_etiqueta,
       -- Portada: la fotografía en primer orden.
       (SELECT f.clave_tarjeta FROM fotografia f
         WHERE f.ejemplar_id = e.id ORDER BY f.orden LIMIT 1) AS portada,
       (SELECT f.texto_alternativo FROM fotografia f
         WHERE f.ejemplar_id = e.id ORDER BY f.orden LIMIT 1) AS portada_alterno,
       -- Cuántas fotografías tiene. Es el dato del que depende que exista o no
       -- para el público: sin ninguna, el ejemplar no sale (ver CON_FOTOGRAFIA).
       (SELECT COUNT(*) FROM fotografia f WHERE f.ejemplar_id = e.id) AS fotografias,
       -- Si el semáforo conductual deja publicar, en 1 o 0. NO viaja el valor:
       -- el semáforo es un dato de la Secretaría (D-26) y una pantalla pública
       -- no debe poder pintarlo ni por descuido. Lo que necesita saber el
       -- portal no es de qué color está, sino si puede enseñarlo.
       (e.semaforo = 'VERDE') AS apto_publico`;

/* --------------------------------------------------------------------------
 * UN EJEMPLAR SIN FOTOGRAFÍA NO EXISTE PARA EL PÚBLICO
 *
 * Decisión del 17 de septiembre de 2026: tener al menos una fotografía es
 * condición para aparecer en el portal, no una recomendación.
 *
 * El motivo es del programa, no técnico: una ficha sin fotografía no consigue
 * adopciones. Quien busca compañero mira primero la imagen; una silueta
 * genérica con la leyenda «Pronto tendré foto» ocupa un lugar en el catálogo
 * sin darle oportunidad al animal, y además hace ver descuidado al programa.
 *
 * Se impone AQUÍ, en la capa que consulta, y no confiando en que la persona
 * recuerde subir la foto antes de marcar Disponible. Un olvido no puede
 * publicar una ficha vacía: aunque alguien marque el ejemplar como Disponible,
 * mientras no tenga fotografía el portal no lo devuelve.
 *
 * CONSECUENCIA EN ADMINISTRACIÓN: el catálogo interno marca esos ejemplares
 * como «Sin fotografía · no aparece en el portal», para que la ausencia no sea
 * un misterio sino una tarea pendiente.
 * ----------------------------------------------------------------------- */
const CON_FOTOGRAFIA = 'EXISTS (SELECT 1 FROM fotografia f WHERE f.ejemplar_id = e.id)';

/* --------------------------------------------------------------------------
 * SÓLO SE PUBLICA LO QUE ESTÁ EN VERDE
 *
 * Al programa entran únicamente ejemplares en semáforo verde, y la regla no
 * se detiene en la puerta: un ejemplar ya publicado que se marca amarillo
 * —porque mordió, porque su conducta cambió— sale del portal en cuanto se
 * guarda el cambio.
 *
 * Se impone aquí, en la consulta, por el mismo motivo que la fotografía: si
 * dependiera de que alguien se acuerde de darlo de baja además de marcarlo
 * amarillo, la regla se rompería el día que hubiera prisa.
 *
 * CONSECUENCIA EN ADMINISTRACIÓN: el catálogo interno marca esos ejemplares
 * como «Amarillo · no aparece en el portal», y la ficha lo advierte al elegir
 * el valor. Un ejemplar que desaparece sin explicación es peor que uno que no
 * se puede publicar.
 * ----------------------------------------------------------------------- */
const EN_VERDE = "e.semaforo = 'VERDE'";

const DE = `
  FROM ejemplar e
  JOIN edad  ed ON ed.clave = e.edad_clave
  JOIN sexo  sx ON sx.clave = e.sexo_clave
  JOIN talla tl ON tl.clave = e.talla_clave`;

/* Un ejemplar para una pantalla que mira la ciudadanía: ficha, identificación
 * y acuse. Devuelve `id` porque la galería lo necesita para pedir las fotos,
 * pero ningún campo interno. */
export async function obtenerParaVistaPublica(slug) {
  if (!slug) return null;

  return obtenerBase()
    .prepare(`SELECT e.id, ${CAMPOS_PUBLICOS} ${DE} WHERE e.slug = ?`)
    .bind(slug)
    .first();
}

/* Un ejemplar para el formulario de adopción.
 *
 * Aquí sí hacen falta los campos internos, y por una razón concreta: la
 * solicitud guarda una instantánea del registro al momento del envío —folio
 * interno, centro y semáforo—, para que meses después se sepa a qué animal se
 * refería aunque la ficha haya cambiado. Esa instantánea se escribe en la
 * base; no se pinta en la pantalla.
 *
 * Por eso son dos funciones y no una con un parámetro: la que alimenta las
 * pantallas públicas no puede traer estos campos aunque alguien se equivoque
 * al llamarla. */
export async function obtenerParaSolicitud(slug) {
  if (!slug) return null;

  return obtenerBase()
    .prepare(
      `SELECT e.id, ${CAMPOS_PUBLICOS},
              e.folio_interno, e.centro_origen_clave, e.centro_actual_clave, e.semaforo,
              -- Las claves, no las etiquetas: la instantánea guarda el valor
              -- del catálogo, que no cambia aunque se reescriba la etiqueta.
              e.edad_clave, e.sexo_clave, e.talla_clave,
              -- Para que una solicitud nacida de un registro de prueba quede
              -- marcada como prueba y se pueda retirar con el resto.
              e.es_ficticio
         ${DE}
        WHERE e.slug = ?`
    )
    .bind(slug)
    .first();
}

/** ¿El portal puede admitir que este ejemplar existe?
 *  Es la primera pregunta de toda pantalla pública. Si responde que no, se
 *  contesta 404 y no se pinta nada. */
export function reconocible(ejemplar) {
  return Boolean(ejemplar) && !NO_RECONOCIBLES.includes(ejemplar.condicion);
}

/** ¿Aparece en el catálogo y tiene ficha? */
export function visibleEnCatalogo(ejemplar) {
  if (!ejemplar) return false;
  if (FUERA_DEL_CATALOGO.includes(ejemplar.condicion)) return false;
  // Sin fotografía no hay ficha, y en amarillo tampoco. Las consultas de
  // listado ya los excluyen; esto cubre la consulta por slug, que llega por
  // dirección directa y no pasa por ellas.
  if (Number(ejemplar.apto_publico ?? 0) !== 1) return false;
  return Number(ejemplar.fotografias ?? 0) > 0;
}

/** ¿Este ejemplar admite solicitudes?
 *  Disponible y En proceso sí: el modelo es de lista de espera (D-09). */
export function admiteSolicitudes(ejemplar) {
  return visibleEnCatalogo(ejemplar);
}

/* --------------------------------------------------------------------------
 * Catálogo público — etapa 3
 *
 * El filtrado vive aquí, no en el navegador. Hasta la etapa 2 el portal
 * mandaba las treinta tarjetas y el navegador escondía las que no coincidían;
 * con cientos de registros eso deja de ser viable. A cambio, las direcciones
 * se vuelven compartibles: /seres-sintientes?edad=JOVEN&talla=CHICO es un
 * enlace que se puede mandar por mensaje.
 *
 * Mismas dos disciplinas que en la administración: lista blanca para lo que
 * llega por la dirección, y valores como parámetros, nunca concatenados.
 * ----------------------------------------------------------------------- */

export const POR_PAGINA = 16;

/** Catálogos para pintar los filtros. Sólo los activos. */
export async function catalogosPublicos() {
  const db = obtenerBase();
  const consulta = (tabla) =>
    db.prepare(`SELECT clave, etiqueta FROM ${tabla} WHERE activo = 1 ORDER BY orden`).all();

  const [edad, sexo, talla] = await Promise.all([
    consulta('edad'), consulta('sexo'), consulta('talla'),
  ]);
  return { edad: edad.results, sexo: sexo.results, talla: talla.results };
}

const permitido = (valor, lista) =>
  lista.some((x) => x.clave === valor) ? valor : '';

/**
 * Los ejemplares de la vitrina de la portada.
 *
 * POR QUÉ NO SON LOS MÁS RECIENTES
 * Antes la portada tomaba la primera página del catálogo —ordenada por fecha
 * de registro descendente— y se quedaba con los doce disponibles. Eso hacía
 * que un ejemplar que lleva ocho meses esperando no se asomara nunca a la
 * portada, mientras el que entró ayer aparecía solo. Justo al revés de lo que
 * necesita un programa de adopción: los que más tardan en salir son los
 * adultos y los de talla grande, y son los que más ayuda necesitan.
 *
 * Ahora se ordena por antigüedad ascendente: primero quien lleva más tiempo.
 *
 * Además consulta directamente por condición DISPONIBLE, en lugar de filtrar
 * después sobre una página ya traída. Con el método anterior, si entre los
 * dieciséis más recientes había pocos disponibles, la vitrina salía con menos
 * de doce sin que nada lo advirtiera.
 */
/* Meses cumplidos entre dos fechas. Se cuenta por mes y no por días porque
   lo que se va a mostrar es una frase, no una medición. */
function mesesDesde(iso) {
  if (!iso) return 0;
  const desde = new Date(iso);
  if (Number.isNaN(desde.getTime())) return 0;
  const ahora = new Date();
  let meses = (ahora.getFullYear() - desde.getFullYear()) * 12
            + (ahora.getMonth() - desde.getMonth());
  if (ahora.getDate() < desde.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/** A partir de cuántos meses se considera que un ejemplar lleva esperando. */
export const MESES_DE_ESPERA = 6;

/**
 * La frase de espera de un ejemplar, o null si todavía no aplica.
 *
 * POR QUÉ ESTO Y NO UN CONTADOR DE SOLICITUDES
 * La pregunta de origen era si convenía mostrarle a la ciudadanía cuántas
 * solicitudes tiene cada ejemplar, para que eligiera los menos solicitados y
 * subiera su probabilidad. La intención es buena; el número se voltea:
 *
 *   · «0 solicitudes» no se lee como oportunidad, se lee como «nadie lo
 *     quiere», y los que mostrarían cero son justo los adultos y los de talla
 *     grande, que son los que más ayuda necesitan.
 *   · Convierte la adopción en una competencia por probabilidad, cuando todo
 *     el cuestionario existe para medir idoneidad. Un animal mal emparejado
 *     porque «estaba libre» es una devolución esperando a ocurrir.
 *
 * El tiempo de espera consigue lo mismo al revés: reparte la demanda hacia
 * quien lleva más tiempo, y lo hace poniendo en valor algo que hoy es
 * invisible en lugar de señalar una carencia. Sólo aparece cuando hay algo
 * que decir: por debajo del umbral no se muestra nada.
 */
export function esperaDe(ejemplar) {
  const meses = mesesDesde(ejemplar?.creado_en);
  if (meses < MESES_DE_ESPERA) return null;
  if (meses >= 24) return 'Lleva más de dos años esperando';
  if (meses >= 12) return 'Lleva más de un año esperando';
  return `Lleva ${meses} meses esperando`;
}

/**
 * Otros ejemplares que llevan más tiempo esperando, para ofrecerlos al final
 * de una ficha. Se excluye el que se está viendo.
 */
export async function otrosEsperando(slugExcluido, limite = 3) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT ${CAMPOS_PUBLICOS}
         ${DE}
        WHERE e.condicion = 'DISPONIBLE' AND e.slug <> ?
          AND ${CON_FOTOGRAFIA} AND ${EN_VERDE}
        ORDER BY e.creado_en ASC, e.id ASC
        LIMIT ?`
    )
    .bind(slugExcluido, limite)
    .all();
  return results;
}

export async function vitrina(limite = 12) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT ${CAMPOS_PUBLICOS}
         ${DE}
        WHERE e.condicion = 'DISPONIBLE' AND ${CON_FOTOGRAFIA} AND ${EN_VERDE}
        ORDER BY e.creado_en ASC, e.id ASC
        LIMIT ?`
    )
    .bind(limite)
    .all();
  return results;
}

export async function buscarPublico(filtros = {}, catalogos) {
  const db = obtenerBase();

  /* La exclusión también va como parámetros, no concatenada. Los valores son
     nuestros y no vienen del navegador, pero la regla vale igual: en cuanto se
     admite una excepción, la siguiente concatenación ya no llama la atención. */
  const donde = [
    `e.condicion NOT IN (${FUERA_DEL_CATALOGO.map(() => '?').join(', ')})`,
    CON_FOTOGRAFIA,
    EN_VERDE,
  ];
  const valores = [...FUERA_DEL_CATALOGO];

  const edad = permitido(filtros.edad, catalogos.edad);
  if (edad) { donde.push('e.edad_clave = ?'); valores.push(edad); }

  const sexo = permitido(filtros.sexo, catalogos.sexo);
  if (sexo) { donde.push('e.sexo_clave = ?'); valores.push(sexo); }

  const talla = permitido(filtros.talla, catalogos.talla);
  if (talla) { donde.push('e.talla_clave = ?'); valores.push(talla); }

  const texto = String(filtros.texto ?? '').trim();
  if (texto) {
    // Sólo por nombre: el folio interno es un dato de la Secretaría y no se
    // busca desde el portal público.
    donde.push('LOWER(e.nombre) LIKE LOWER(?)');
    valores.push(`%${texto}%`);
  }

  const filtro = `WHERE ${donde.join(' AND ')}`;

  const { total } = await db
    .prepare(`SELECT COUNT(*) AS total FROM ejemplar e ${filtro}`)
    .bind(...valores)
    .first();

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number(filtros.pagina) || 1), paginas);

  const { results } = await db
    .prepare(
      `SELECT ${CAMPOS_PUBLICOS}
         ${DE}
         ${filtro}
        ORDER BY e.creado_en DESC, e.id DESC
        LIMIT ? OFFSET ?`
    )
    .bind(...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA)
    .all();

  return {
    ejemplares: results, total, pagina, paginas,
    filtros: { edad, sexo, talla, texto },
  };
}

/** Las fotografías de un ejemplar, para la galería de su ficha. */
export async function fotosDe(ejemplarId) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT clave_ficha, clave_tarjeta, texto_alternativo
         FROM fotografia WHERE ejemplar_id = ? ORDER BY orden`
    )
    .bind(ejemplarId)
    .all();
  return results;
}

/** ¿Queda algún registro de prueba en la base?
 *  Es lo que enciende el aviso de «sitio en desarrollo»: mientras exista uno
 *  solo, el aviso se muestra. Se apaga solo cuando se retiran. */
export async function hayRegistrosFicticios() {
  const fila = await obtenerBase()
    .prepare(`SELECT EXISTS (SELECT 1 FROM ejemplar WHERE es_ficticio = 1) AS hay`)
    .first();
  return Boolean(fila?.hay);
}
