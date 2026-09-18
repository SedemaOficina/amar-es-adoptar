/* Solicitudes de adopción vistas desde la administración.
 *
 * ALCANCE Y DATOS PERSONALES
 *
 * Una solicitud contiene CURP y domicilio. Dos reglas gobiernan este archivo:
 *
 *   1. El capturista sólo ve las solicitudes de los ejemplares de su centro;
 *      la Oficina de la Secretaría las ve todas. Es la misma regla de alcance
 *      del catálogo (D-39): la impone el servidor, no la pantalla.
 *   2. Abrir una solicitud queda registrado en bitácora como acceso a dato
 *      personal. Por eso el listado no muestra CURP ni domicilio: si los
 *      mostrara, cualquier vistazo sería un acceso masivo sin registro.
 */
import { obtenerBase } from './base-de-datos.js';
import { PREGUNTAS_UNICAS, PREGUNTAS_MULTIPLES, LETRAS_MULTIPLES } from './cuestionario.js';

export const POR_PAGINA = 20;

/** Los seis pasos del flujo, en orden. La base los impone (migración 0004). */
export const ESTADOS = [
  { clave: 'RECIBIDA',    etiqueta: 'Recibida',    ayuda: 'Llegó y nadie la ha revisado.' },
  { clave: 'EN_REVISION', etiqueta: 'En revisión', ayuda: 'El centro está valorando el cuestionario.' },
  { clave: 'CONTACTADA',  etiqueta: 'Contactada',  ayuda: 'Ya se habló con la persona solicitante.' },
  { clave: 'APROBADA',    etiqueta: 'Aprobada',    ayuda: 'Procede la adopción.' },
  { clave: 'RECHAZADA',   etiqueta: 'Rechazada',   ayuda: 'No procede. Conviene anotar el motivo en bitácora.' },
  { clave: 'CONCLUIDA',   etiqueta: 'Concluida',   ayuda: 'El ejemplar ya fue entregado.' },
];

export const CLAVES_ESTADO = ESTADOS.map((e) => e.clave);

/* Los tres estados que todavía esperan una decisión del centro. Existe como
   filtro propio porque es la pregunta que el personal hace de verdad —«¿qué me
   falta atender?»— y porque el tablero de indicadores cuenta exactamente esto:
   si el número dijera una cosa y el enlace llevara a otra, el tablero mentiría. */
export const SIN_RESOLVER = ['RECIBIDA', 'EN_REVISION', 'CONTACTADA'];
export const FILTRO_SIN_RESOLVER = 'SIN_RESOLVER';

export function etiquetaEstado(clave) {
  return ESTADOS.find((e) => e.clave === clave)?.etiqueta ?? clave;
}

function ahora() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/* El alcance sigue al ejemplar vivo, no a la instantánea: si el animal fue
   trasladado, quien lo tiene hoy es quien debe atender la solicitud. Si el
   ejemplar fue dado de baja, se recurre a la instantánea para que la
   solicitud no quede sin dueño. */
const CENTRO_EFECTIVO = 'COALESCE(e.centro_actual_clave, s.snap_centro_actual)';

function alcance(persona) {
  if (persona.rol === 'CAPTURISTA') {
    return { sql: `${CENTRO_EFECTIVO} = ?`, valores: [persona.centro_clave] };
  }
  return { sql: null, valores: [] };
}

export async function buscar(persona, filtros = {}) {
  const db = obtenerBase();
  const donde = [];
  const valores = [];

  const limite = alcance(persona);
  if (limite.sql) { donde.push(limite.sql); valores.push(...limite.valores); }

  const pedido = filtros.estado;
  const estado = pedido === FILTRO_SIN_RESOLVER || CLAVES_ESTADO.includes(pedido) ? pedido : '';

  if (estado === FILTRO_SIN_RESOLVER) {
    donde.push(`s.estado IN (${SIN_RESOLVER.map(() => '?').join(',')})`);
    valores.push(...SIN_RESOLVER);
  } else if (estado) {
    donde.push('s.estado = ?');
    valores.push(estado);
  }

  // Búsqueda por folio de solicitud, por nombre de la persona o por el
  // ejemplar: son las tres formas en que el personal la busca de verdad.
  const texto = String(filtros.texto ?? '').trim();
  if (texto) {
    donde.push(`(s.folio LIKE ?
                 OR LOWER(s.nombres || ' ' || s.primer_apellido || ' ' ||
                          COALESCE(s.segundo_apellido, '')) LIKE LOWER(?)
                 OR LOWER(s.snap_nombre) LIKE LOWER(?)
                 OR s.snap_folio_interno LIKE ?)`);
    valores.push(`%${texto}%`, `%${texto}%`, `%${texto}%`, `%${texto}%`);
  }

  const filtro = donde.length ? `WHERE ${donde.join(' AND ')}` : '';
  const desdeTablas = 'FROM solicitud s LEFT JOIN ejemplar e ON e.id = s.ejemplar_id';

  const { total } = await db
    .prepare(`SELECT COUNT(*) AS total ${desdeTablas} ${filtro}`)
    .bind(...valores)
    .first();

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number(filtros.pagina) || 1), paginas);

  const { results } = await db
    .prepare(
      `SELECT s.id, s.folio, s.recibida_en, s.estado, s.estado_en, s.es_ficticio,
              s.snap_nombre, s.snap_folio_interno, s.ejemplar_id,
              s.nombres, s.primer_apellido, s.segundo_apellido,
              ${CENTRO_EFECTIVO} AS centro_clave,
              e.slug AS ejemplar_slug,
              -- Portada del ejemplar: con la cara del animal, quien atiende
              -- identifica de qué solicitud se trata sin leer el renglón.
              (SELECT f.clave_miniatura FROM fotografia f
                WHERE f.ejemplar_id = e.id ORDER BY f.orden LIMIT 1) AS portada
         ${desdeTablas} ${filtro}
        ORDER BY s.recibida_en DESC
        LIMIT ? OFFSET ?`
    )
    .bind(...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA)
    .all();

  return { solicitudes: results, total, pagina, paginas, estado, texto };
}

/** Una solicitud completa, con la comprobación de alcance incluida. */
export async function obtener(persona, folio) {
  const limite = alcance(persona);
  const filtro = limite.sql ? `AND ${limite.sql}` : '';

  return obtenerBase()
    .prepare(
      `SELECT s.*, ${CENTRO_EFECTIVO} AS centro_clave, e.slug AS ejemplar_slug,
              (SELECT f.clave_tarjeta FROM fotografia f
                WHERE f.ejemplar_id = e.id ORDER BY f.orden LIMIT 1) AS portada,
              c.etiqueta AS centro_etiqueta,
              u.nombre AS estado_por_nombre
         FROM solicitud s
         LEFT JOIN ejemplar e ON e.id = s.ejemplar_id
         LEFT JOIN centro  c ON c.clave = COALESCE(e.centro_actual_clave, s.snap_centro_actual)
         LEFT JOIN usuario u ON u.id = s.estado_por
        WHERE s.folio = ? ${filtro}`
    )
    .bind(folio, ...limite.valores)
    .first();
}

/** Deja constancia de que alguien miró los datos personales de una solicitud. */
export async function registrarAccesoADatoPersonal(solicitudId, persona, ip) {
  await obtenerBase()
    .prepare(
      `INSERT INTO bitacora (entidad, entidad_id, accion, usuario_id, ocurrido_en, ip)
       VALUES ('SOLICITUD', ?, 'ACCESO_DATO_PERSONAL', ?, ?, ?)`
    )
    .bind(solicitudId, persona.id, ahora(), ip)
    .run();
}

/**
 * Cambia el estado de la solicitud.
 *
 * No se impone un orden rígido entre los seis pasos: la realidad de un centro
 * no siempre avanza en línea recta y un sistema que lo exija termina con todo
 * el mundo dejando las solicitudes en «Recibida». Lo que sí queda es el
 * rastro: cada cambio se apunta en bitácora con quién y cuándo.
 */
export async function cambiarEstado(persona, solicitud, nuevo, nota, ip) {
  if (!CLAVES_ESTADO.includes(nuevo)) {
    return { error: 'Ese estado no existe.' };
  }
  if (nuevo === solicitud.estado) {
    return { sinCambios: true };
  }

  const db = obtenerBase();
  await db.batch([
    db.prepare(
      `UPDATE solicitud SET estado = ?, estado_en = ?, estado_por = ? WHERE id = ?`
    ).bind(nuevo, ahora(), persona.id, solicitud.id),

    db.prepare(
      `INSERT INTO bitacora
         (entidad, entidad_id, accion, campo, valor_anterior, valor_nuevo, usuario_id, ocurrido_en, ip, respaldo)
       VALUES ('SOLICITUD', ?, 'CAMBIO', 'estado', ?, ?, ?, ?, ?, ?)`
    ).bind(solicitud.id, solicitud.estado, nuevo, persona.id, ahora(), ip, nota || null),
  ]);

  return { ok: true };
}

/** Cuántas solicitudes ha recibido un ejemplar, por estado y en total. */
export async function contarPorEjemplar(ejemplarId) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT estado, COUNT(*) AS cuantas FROM solicitud
        WHERE ejemplar_id = ? GROUP BY estado`
    )
    .bind(ejemplarId)
    .all();

  const total = results.reduce((suma, r) => suma + r.cuantas, 0);
  // Las que siguen esperando una decisión del centro.
  const abiertas = results
    .filter((r) => !['APROBADA', 'RECHAZADA', 'CONCLUIDA'].includes(r.estado))
    .reduce((suma, r) => suma + r.cuantas, 0);

  return { total, abiertas, porEstado: results };
}

/** Movimientos registrados de una solicitud. */
export async function historial(solicitudId) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT b.accion, b.campo, b.valor_anterior, b.valor_nuevo, b.ocurrido_en,
              b.respaldo, u.nombre AS usuario
         FROM bitacora b LEFT JOIN usuario u ON u.id = b.usuario_id
        WHERE b.entidad = 'SOLICITUD' AND b.entidad_id = ?
        ORDER BY b.id DESC`
    )
    .bind(solicitudId)
    .all();
  return results;
}

/* --------------------------------------------------------------------------
 * Exportación a CSV
 *
 * Las columnas son las del diccionario del documento de requerimientos
 * (apartado 6.1), con tres agregados acordados: CENTRO_ORIGEN, CONDICION y
 * ESTADO_SOLICITUD. Las columnas concatenadas no se guardan en la base: se
 * calculan aquí, que es donde el documento dice que existen.
 * ----------------------------------------------------------------------- */

const ETIQUETA_UNICA = {
  p1: 'P1_ATENCION_VETERINARIA',
  p3: 'P3_ACTIVIDAD_CONVIVENCIA',
  p4: 'P4_EXPERIENCIA',
  p5: 'P5_ACUERDO_HOGAR',
  p6: 'P6_COMPROMISO_PROCESO',
  p7: 'P7_TIPO_VIVIENDA',
  p9: 'P9_SITUACION_LABORAL',
};

const SUFIJO_MULTIPLE = { p2: 'CUIDADOS_DE_POR_VIDA', p8: 'COMPOSICION_HOGAR' };

export function columnasCSV() {
  const columnas = [
    'FOLIO_SOLICITUD', 'FECHA_SOLICITUD', 'HORA_SOLICITUD', 'ESTADO_SOLICITUD',
    'FOLIO_INTERNO', 'UBICACION', 'CENTRO_ORIGEN', 'SEMAFORO_CONDUCTUAL',
    'NOMBRE_EJEMPLAR', 'EDAD', 'SEXO', 'TALLA', 'CONDICION',
    'NOMBRES', 'PRIMER_APELLIDO', 'SEGUNDO_APELLIDO', 'CURP',
    'CALLE', 'NUMERO_EXTERIOR', 'NUMERO_INTERIOR', 'CODIGO_POSTAL',
    'ALCALDIA', 'COLONIA', 'TELEFONO_CELULAR', 'CORREO_ELECTRONICO',
  ];

  for (const { campo, numero } of [...PREGUNTAS_UNICAS].sort((a, b) => a.numero - b.numero)) {
    columnas.push(ETIQUETA_UNICA[campo]);
    // Las múltiples se intercalan en su lugar por número de pregunta.
    const multiple = PREGUNTAS_MULTIPLES.find((m) => m.numero === numero + 1);
    if (multiple) {
      for (const letra of LETRAS_MULTIPLES) {
        columnas.push(`${multiple.prefijo.toUpperCase()}_${letra.toUpperCase()}_${SUFIJO_MULTIPLE[multiple.prefijo]}`);
      }
      columnas.push(`${multiple.prefijo.toUpperCase()}_CONCATENAR`);
    }
  }

  return columnas;
}

/** Una celda de CSV: se entrecomilla siempre y se duplican las comillas. */
function celda(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function renglon(s) {
  const fecha = new Date(s.recibida_en);
  const dia = fecha.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
  const hora = fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const concatenar = (prefijo) =>
    LETRAS_MULTIPLES.filter((l) => s[`${prefijo}_${l}`]).map((l) => l.toUpperCase()).join(',');

  const datos = [
    s.folio, dia, hora, etiquetaEstado(s.estado),
    s.snap_folio_interno, s.snap_centro_actual, s.snap_centro_origen, s.snap_semaforo,
    s.snap_nombre, s.snap_edad, s.snap_sexo, s.snap_talla, s.snap_condicion,
    s.nombres, s.primer_apellido, s.segundo_apellido, s.curp,
    s.calle, s.numero_exterior, s.numero_interior, s.codigo_postal,
    s.alcaldia, s.colonia, s.telefono_celular, s.correo_electronico,
  ];

  for (const { campo, numero } of [...PREGUNTAS_UNICAS].sort((a, b) => a.numero - b.numero)) {
    datos.push(s[campo]);
    const multiple = PREGUNTAS_MULTIPLES.find((m) => m.numero === numero + 1);
    if (multiple) {
      for (const letra of LETRAS_MULTIPLES) {
        datos.push(s[`${multiple.prefijo}_${letra}`] ? letra.toUpperCase() : '');
      }
      datos.push(concatenar(multiple.prefijo));
    }
  }

  return datos.map(celda).join(',');
}

/** Devuelve el CSV completo, ya con el alcance de la persona aplicado. */
export async function exportarCSV(persona) {
  const limite = alcance(persona);
  const filtro = limite.sql ? `WHERE ${limite.sql}` : '';

  const { results } = await obtenerBase()
    .prepare(
      `SELECT s.* FROM solicitud s
       LEFT JOIN ejemplar e ON e.id = s.ejemplar_id
       ${filtro}
       ORDER BY s.folio`
    )
    .bind(...limite.valores)
    .all();

  const lineas = [columnasCSV().map(celda).join(','), ...results.map(renglon)];

  // BOM al principio: sin él, Excel en Windows abre el archivo en su
  // codificación local y los acentos salen rotos.
  return { contenido: '﻿' + lineas.join('\r\n') + '\r\n', total: results.length };
}

export function nombreArchivoCSV() {
  const f = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `solicitudes_adopcion_${f.getFullYear()}${dos(f.getMonth() + 1)}${dos(f.getDate())}_${dos(f.getHours())}${dos(f.getMinutes())}.csv`;
}
