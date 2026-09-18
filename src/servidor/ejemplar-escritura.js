/* Alta, edición y bitácora de ejemplares.
 *
 * Todas las reglas del registro viven aquí, no en los formularios. El
 * formulario es comodidad para quien captura; esto es lo que decide qué se
 * guarda. Nada de lo que llegue del navegador se cree sin comprobarse.
 */
import { obtenerBase } from './base-de-datos.js';
import {
  guardar as guardarFotografia, listar as listarFotografias, retirarArchivos,
} from './fotografias.js';

/* Semáforo conductual.
 *
 * AMARILLO sigue existiendo, pero NO se puede elegir al dar de alta: al
 * programa sólo entran ejemplares en verde. Se conserva porque una conducta
 * cambia después del registro —un animal que muerde a alguien un mes más
 * tarde— y esa información tiene que poder asentarse. Marcarlo amarillo lo
 * retira del portal público, igual que quedarse sin fotografía.
 *
 * Por eso son dos listas y no una: lo que admite la base no es lo mismo que
 * lo que ofrece el alta. */
export const SEMAFOROS = ['VERDE', 'AMARILLO'];

/** El único semáforo con el que un ejemplar entra al programa. */
export const SEMAFORO_DE_INGRESO = 'VERDE';

/* Las condiciones que el formulario ofrece. BAJA no está aquí a propósito:
   no es un valor que se elija de una lista, es un acto con motivo y su propio
   camino. Si estuviera en el desplegable, alguien la escogería sin motivo y
   la base lo rechazaría con un error incomprensible. */
export const CONDICIONES = ['DISPONIBLE', 'EN_PROCESO', 'ADOPTADO'];

/* Motivos de baja. Cerrados a propósito: «otro» existe, pero obliga a
   escribir una nota, para que la excepción no se vuelva el camino fácil. */
export const MOTIVOS_BAJA = [
  { clave: 'FALLECIMIENTO',     etiqueta: 'Falleció' },
  { clave: 'TRASLADO_EXTERNO',  etiqueta: 'Se trasladó fuera del programa' },
  { clave: 'CAMBIO_CONDUCTUAL', etiqueta: 'Su conducta cambió: ya no es apto para adopción' },
  { clave: 'DUPLICADO',         etiqueta: 'Registro duplicado' },
  { clave: 'OTRO',              etiqueta: 'Otro motivo (explícalo abajo)' },
];

/* Motivos que obligan a escribir una nota.
   · OTRO, porque si no la excepción se vuelve el camino fácil.
   · CAMBIO_CONDUCTUAL, porque de él depende que un animal salga del programa:
     qué pasó, cuándo y con quién es justamente lo que alguien va a preguntar
     después, y no puede quedarse en la memoria de quien capturó. */
export const MOTIVOS_CON_NOTA = ['OTRO', 'CAMBIO_CONDUCTUAL'];

/** Cambios de condición que retiran o reincorporan un ejemplar del público
 *  y por eso exigen confirmación explícita de quien los hace. */
export function exigeConfirmacion(anterior, nueva) {
  if (anterior === nueva) return false;
  return nueva === 'ADOPTADO' || anterior === 'ADOPTADO';
}

/**
 * Normaliza el folio a cinco dígitos con ceros a la izquierda.
 * Quien escriba 147 obtiene 00147. Devuelve null si no son sólo dígitos o
 * si no cabe en cinco posiciones.
 */
export function normalizarFolio(valor) {
  const limpio = String(valor ?? '').trim();
  if (!/^\d{1,5}$/.test(limpio)) return null;
  return limpio.padStart(5, '0');
}

function texto(valor, maximo) {
  const limpio = String(valor ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length === 0 || limpio.length > maximo ? null : limpio;
}

/**
 * Comprueba lo que llega del formulario.
 *
 * @returns { valores, errores } — errores es un objeto campo → mensaje.
 *          Si tiene alguna clave, no se escribe nada.
 */
export function validar(datos, claves, { esAlta, folioDesbloqueado = false }) {
  const errores = {};
  const valores = {};

  valores.nombre = texto(datos.nombre, 120);
  if (!valores.nombre) errores.nombre = 'Escribe el nombre asignado al ejemplar.';

  // En el alta el folio siempre se captura. En la edición sólo si quien llama
  // dice que venía desbloqueado: la decisión se pasa aquí explícitamente y no
  // se adivina leyendo un campo del formulario.
  if (esAlta || folioDesbloqueado) {
    valores.folio_interno = normalizarFolio(datos.folio_interno);
    if (!valores.folio_interno) {
      errores.folio_interno = 'El folio son de uno a cinco dígitos. Se completa con ceros a la izquierda.';
    }
  }

  for (const [campo, admitidos, mensaje] of [
    ['edad_clave', claves.edad, 'Elige la edad.'],
    ['sexo_clave', claves.sexo, 'Elige el sexo.'],
    ['talla_clave', claves.talla, 'Elige la talla.'],
  ]) {
    const v = String(datos[campo] ?? '');
    if (!admitidos.includes(v)) errores[campo] = mensaje;
    else valores[campo] = v;
  }

  /* El semáforo NO se captura en ninguna pantalla.
     · En el alta se impone VERDE, porque al programa sólo entran verdes.
     · En la edición no se toca: si la conducta de un ejemplar cambia, lo que
       corresponde es DARLO DE BAJA con su motivo y su nota, no cambiarle un
       desplegable y que desaparezca del portal sin dejar razón escrita.
     Lo que llegue del navegador en este campo se ignora en los dos casos: un
     campo que la pantalla no muestra es justamente el que alguien podría
     mandar a mano. Al no ponerlo en `valores`, la edición ni siquiera lo
     compara, así que el valor guardado se queda como estaba. */
  if (esAlta) valores.semaforo = SEMAFORO_DE_INGRESO;

  const condicion = String(datos.condicion ?? '');
  if (!CONDICIONES.includes(condicion)) errores.condicion = 'Elige la condición.';
  else valores.condicion = condicion;

  if (esAlta) {
    const centro = String(datos.centro_origen_clave ?? '');
    if (!claves.centro.includes(centro)) errores.centro_origen_clave = 'Elige el centro.';
    else valores.centro_origen_clave = centro;
  } else {
    const centro = String(datos.centro_actual_clave ?? '');
    if (!claves.centro.includes(centro)) errores.centro_actual_clave = 'Elige el centro.';
    else valores.centro_actual_clave = centro;
  }

  return { valores, errores };
}

/**
 * Completa el centro que el formulario no muestra.
 *
 * A un capturista no se le pide el centro: se lo impone su perfil, y por eso
 * el campo no existe en su pantalla. Si no se rellena aquí, llega vacío a la
 * validación, ésta lo rechaza, y el mensaje de error no tiene dónde pintarse
 * porque el desplegable tampoco existe. El resultado sería un guardado que
 * falla en silencio: exactamente lo que no queremos en un sistema de captura.
 *
 * Vive con las demás reglas y no en la pantalla, para que una pantalla nueva
 * no vuelva a olvidarla.
 */
export function aplicarCentroDelPerfil(persona, datos, { esAlta, ejemplar = null }) {
  if (persona.rol !== 'CAPTURISTA') return datos;

  if (esAlta) {
    return { ...datos, centro_origen_clave: persona.centro_clave };
  }
  // En edición tampoco traslada: conserva el centro que ya tenía el registro.
  return { ...datos, centro_actual_clave: ejemplar.centro_actual_clave };
}

/** Identificador público: legible, estable y no adivinable en secuencia. */
async function generarSlug(db, nombre) {
  const base = nombre
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ejemplar';

  for (let intento = 0; intento < 6; intento++) {
    const sufijo = Array.from(crypto.getRandomValues(new Uint8Array(2)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const candidato = `${base}-${sufijo}`;
    const existe = await db.prepare('SELECT 1 FROM ejemplar WHERE slug = ?').bind(candidato).first();
    if (!existe) return candidato;
  }
  throw new Error('No se pudo generar un identificador público único.');
}

/** ¿Ya existe ese folio en ese centro de origen? */
export async function folioOcupado(centroOrigen, folio, exceptoId = null) {
  const db = obtenerBase();
  const fila = await db
    .prepare(
      `SELECT nombre FROM ejemplar
        WHERE centro_origen_clave = ? AND folio_interno = ?
          AND (? IS NULL OR id <> ?)`
    )
    .bind(centroOrigen, folio, exceptoId, exceptoId)
    .first();
  return fila ? fila.nombre : null;
}

function ahora() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Una línea de bitácora. */
function apunte(entidadId, accion, campo, antes, despues, usuarioId, ip) {
  return obtenerBase()
    .prepare(
      `INSERT INTO bitacora (entidad, entidad_id, accion, campo, valor_anterior, valor_nuevo, usuario_id, ocurrido_en, ip)
       VALUES ('EJEMPLAR', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(entidadId, accion, campo, antes, despues, usuarioId, ahora(), ip);
}

/**
 * Da de alta un ejemplar.
 * El centro de origen forma la clave junto con el folio y no volverá a cambiar.
 */
/**
 * Alta de ejemplar CON su primera fotografía, en una sola operación.
 *
 * REGLA DEL PROGRAMA: no se da de alta un animal sin fotografía. No es una
 * recomendación ni una validación que se pueda posponer: una ficha sin imagen
 * no consigue adopciones, ocupa un lugar en el catálogo sin darle oportunidad
 * al animal, y hace ver descuidado al programa.
 *
 * POR QUÉ HACE FALTA ESTA FUNCIÓN
 * Una fotografía necesita un ejemplar al que pertenecer: su ruta en el almacén
 * se construye con el identificador del registro, que no existe hasta después
 * de insertarlo. Por eso el orden es inevitable —primero el registro, después
 * la imagen— y por eso hace falta deshacer: si la fotografía no se puede
 * guardar, el registro recién creado se borra y el alta falla entera. Nunca
 * queda un ejemplar a medias.
 *
 * El almacén de objetos no participa de una transacción de base de datos, así
 * que el deshacer es explícito. Es la única forma honesta de sostener la regla.
 */
export async function crearEjemplarConFotografia(persona, valores, lotes, ip) {
  const creado = await crearEjemplar(persona, valores, ip);
  if (creado.errores) return creado;

  const ejemplar = { id: creado.id, nombre: valores.nombre };

  /* Se guardan en el orden en que llegaron: la primera queda como portada.
     Si alguna falla, el alta completa se deshace. No se conserva «lo que sí
     alcanzó a subir» a propósito: quien capturó eligió tres fotografías y
     debe volver a una pantalla que se lo diga, no a un registro a medias que
     nadie va a revisar. */
  for (const archivos of lotes) {
    const guardada = await guardarFotografia(ejemplar, archivos, '');
    if (guardada.error) {
      await deshacerAlta(creado.id);
      return { errores: { fotografia: guardada.error } };
    }
  }

  return creado;
}

/**
 * Borra un alta que no llegó a completarse, con todo lo que alcanzó a dejar.
 *
 * R2 no participa de la transacción de D1: no hay forma de que la subida de
 * archivos y el renglón de la base se deshagan juntos. Así que el deshacer es
 * explícito y va en este orden: primero los archivos, porque un archivo
 * huérfano en R2 se paga y nadie sabría de quién era, y luego los renglones.
 */
async function deshacerAlta(id) {
  try {
    await retirarArchivos(await listarFotografias(id));
  } catch (e) {
    // Si R2 no responde, el registro se borra igual: un archivo suelto es un
    // problema de limpieza; un ejemplar sin fotografía rompe la regla.
    console.error('[alta] no se pudieron retirar los archivos de', id, e);
  }

  const db = obtenerBase();
  await db.batch([
    db.prepare('DELETE FROM fotografia WHERE ejemplar_id = ?').bind(id),
    db.prepare('DELETE FROM bitacora WHERE entidad = ? AND entidad_id = ?')
      .bind('EJEMPLAR', id),
    db.prepare('DELETE FROM ejemplar WHERE id = ?').bind(id),
  ]);
}

export async function crearEjemplar(persona, valores, ip) {
  const db = obtenerBase();

  // Un capturista da de alta en su centro, diga lo que diga el formulario.
  const centroOrigen = persona.rol === 'CAPTURISTA'
    ? persona.centro_clave
    : valores.centro_origen_clave;

  const ocupado = await folioOcupado(centroOrigen, valores.folio_interno);
  if (ocupado) {
    return { errores: { folio_interno: `Ese folio ya lo tiene «${ocupado}» en este centro.` } };
  }

  const slug = await generarSlug(db, valores.nombre);
  const momento = ahora();

  const alta = await db
    .prepare(
      `INSERT INTO ejemplar
         (slug, centro_origen_clave, folio_interno, centro_actual_clave, nombre,
          edad_clave, sexo_clave, talla_clave, semaforo, condicion, es_ficticio,
          creado_en, actualizado_en, creado_por, actualizado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    )
    .bind(
      slug, centroOrigen, valores.folio_interno, centroOrigen, valores.nombre,
      valores.edad_clave, valores.sexo_clave, valores.talla_clave,
      valores.semaforo, valores.condicion,
      momento, momento, persona.id, persona.id
    )
    .run();

  const id = alta.meta.last_row_id;

  await apunte(id, 'ALTA', null, null,
    `${centroOrigen} ${valores.folio_interno} · ${valores.nombre}`, persona.id, ip).run();

  return { slug, id };
}

/** Trae un ejemplar para editarlo, respetando el alcance de la persona. */
export async function obtenerParaEditar(persona, slug) {
  const db = obtenerBase();

  const ejemplar = await db
    .prepare(
      `SELECT e.*, c.etiqueta AS centro_etiqueta
         FROM ejemplar e JOIN centro c ON c.clave = e.centro_actual_clave
        WHERE e.slug = ?`
    )
    .bind(slug)
    .first();

  if (!ejemplar) return null;

  // Un capturista sólo alcanza los de su centro. No es un filtro de pantalla:
  // si pide otro por su dirección, se le responde que no existe.
  if (persona.rol === 'CAPTURISTA' && ejemplar.centro_actual_clave !== persona.centro_clave) {
    return null;
  }

  return ejemplar;
}

const ETIQUETAS = {
  nombre: 'Nombre', folio_interno: 'Folio interno', edad_clave: 'Edad',
  sexo_clave: 'Sexo', talla_clave: 'Talla', semaforo: 'Semáforo conductual',
  condicion: 'Condición', centro_actual_clave: 'Centro',
};

/**
 * Guarda los cambios de un ejemplar y los asienta en bitácora, campo por campo.
 *
 * El folio sólo se toca si venía desbloqueado; si no, se ignora lo que traiga
 * el formulario. Esa comprobación se hace aquí y no en la pantalla, porque una
 * casilla del navegador no es una garantía.
 */
export async function actualizarEjemplar(persona, ejemplar, valores, opciones, ip) {
  const db = obtenerBase();

  const nuevos = { ...valores };
  if (!opciones.folioDesbloqueado) delete nuevos.folio_interno;

  // Un capturista no traslada ejemplares fuera de su centro.
  if (persona.rol === 'CAPTURISTA') delete nuevos.centro_actual_clave;

  if (nuevos.folio_interno && nuevos.folio_interno !== ejemplar.folio_interno) {
    const ocupado = await folioOcupado(ejemplar.centro_origen_clave, nuevos.folio_interno, ejemplar.id);
    if (ocupado) {
      return { errores: { folio_interno: `Ese folio ya lo tiene «${ocupado}» en este centro.` } };
    }
  }

  const cambios = Object.entries(nuevos)
    .filter(([campo, valor]) => String(ejemplar[campo] ?? '') !== String(valor))
    .map(([campo, valor]) => ({ campo, antes: ejemplar[campo], despues: valor }));

  if (cambios.length === 0) return { sinCambios: true };

  const condicionNueva = nuevos.condicion ?? ejemplar.condicion;
  if (exigeConfirmacion(ejemplar.condicion, condicionNueva) && !opciones.confirmaCondicion) {
    return {
      errores: {
        condicion: condicionNueva === 'ADOPTADO'
          ? 'Marcar como adoptado lo retira del catálogo público. Confirma la casilla.'
          : 'Reincorporar un ejemplar adoptado lo devuelve al catálogo público. Confirma la casilla.',
      },
    };
  }

  const momento = ahora();
  const columnas = cambios.map((c) => `${c.campo} = ?`).join(', ');

  const sentencias = [
    db.prepare(`UPDATE ejemplar SET ${columnas}, actualizado_en = ?, actualizado_por = ? WHERE id = ?`)
      .bind(...cambios.map((c) => c.despues), momento, persona.id, ejemplar.id),
  ];

  for (const c of cambios) {
    const accion = c.campo === 'centro_actual_clave' ? 'TRASLADO' : 'CAMBIO';
    sentencias.push(
      apunte(ejemplar.id, accion, ETIQUETAS[c.campo] ?? c.campo,
        String(c.antes ?? ''), String(c.despues), persona.id, ip)
    );
  }

  // En un solo lote: o quedan el cambio y su bitácora, o no queda ninguno.
  await db.batch(sentencias);

  return { cambios: cambios.length };
}

/** ¿Cuántas solicitudes ha recibido este ejemplar? Decide si se puede borrar. */
export async function solicitudesDe(ejemplarId) {
  const { cuantas } = await obtenerBase()
    .prepare(`SELECT COUNT(*) AS cuantas FROM solicitud WHERE ejemplar_id = ?`)
    .bind(ejemplarId)
    .first();
  return cuantas;
}

/**
 * Da de baja un ejemplar: sale del portal público pero el registro se queda.
 *
 * Es lo que corresponde a un animal que sí existió y salió del programa. La
 * baja exige motivo, y la base lo impone además con una restricción propia:
 * un registro que desaparece sin decir por qué es una pregunta sin respuesta
 * dentro de seis meses.
 */
export async function darDeBaja(persona, ejemplar, motivo, nota, ip) {
  if (!MOTIVOS_BAJA.some((m) => m.clave === motivo)) {
    return { error: 'Elige un motivo de baja.' };
  }
  const explicacion = String(nota ?? '').trim();
  if (MOTIVOS_CON_NOTA.includes(motivo) && !explicacion) {
    return {
      error: motivo === 'OTRO'
        ? 'Cuando el motivo es «otro», hay que explicarlo.'
        : 'Escribe qué ocurrió: una baja por conducta tiene que quedar explicada.',
    };
  }
  if (ejemplar.condicion === 'BAJA') {
    return { error: 'Este ejemplar ya está dado de baja.' };
  }

  const db = obtenerBase();
  const momento = ahora();
  const etiqueta = MOTIVOS_BAJA.find((m) => m.clave === motivo).etiqueta;

  await db.batch([
    db.prepare(
      `UPDATE ejemplar
          SET condicion = 'BAJA', baja_motivo = ?, baja_nota = ?, baja_en = ?, baja_por = ?,
              actualizado_en = ?, actualizado_por = ?
        WHERE id = ?`
    ).bind(motivo, explicacion || null, momento, persona.id, momento, persona.id, ejemplar.id),

    apunte(ejemplar.id, 'BAJA', 'condicion', ejemplar.condicion,
           `BAJA · ${etiqueta}${explicacion ? ' · ' + explicacion : ''}`, persona.id, ip),
  ]);

  return { ok: true };
}

/** Reincorpora un ejemplar dado de baja. Vuelve como DISPONIBLE. */
export async function reactivar(persona, ejemplar, ip) {
  if (ejemplar.condicion !== 'BAJA') return { error: 'Este ejemplar no está dado de baja.' };

  const db = obtenerBase();
  const momento = ahora();

  await db.batch([
    db.prepare(
      `UPDATE ejemplar
          SET condicion = 'DISPONIBLE', baja_motivo = NULL, baja_nota = NULL,
              baja_en = NULL, baja_por = NULL,
              actualizado_en = ?, actualizado_por = ?
        WHERE id = ?`
    ).bind(momento, persona.id, ejemplar.id),

    apunte(ejemplar.id, 'CAMBIO', 'condicion', 'BAJA', 'DISPONIBLE', persona.id, ip),
  ]);

  return { ok: true };
}

/**
 * Borrado físico. Sólo para lo que nunca debió existir: un duplicado, una
 * captura errónea recién hecha.
 *
 * Cuatro candados, y ninguno sobra:
 *   1. El alcance ya lo impuso quien trajo el ejemplar: un capturista sólo
 *      llega a los de su centro.
 *   2. Cero solicitudes. Si alguien llegó a preguntar por este animal, su
 *      historia importa y lo que corresponde es la baja, no el borrado.
 *   3. Hay que escribir el folio. Un botón de confirmación se aprieta sin
 *      leer; escribir 00147 exige mirar qué se está borrando.
 *   4. Queda un respaldo completo en JSON dentro de la bitácora, antes de
 *      borrar. Es lo único que permite reconstruir un borrado equivocado.
 *
 * Las fotografías se retiran del almacén antes de soltar el registro: si se
 * borrara primero el registro, sus archivos quedarían en R2 para siempre, sin
 * nadie que supiera de quién eran.
 */
export async function eliminarEjemplar(persona, ejemplar, confirmacion, ip, retirarFotos) {
  if (String(confirmacion ?? '').trim() !== ejemplar.folio_interno) {
    return { error: `Para borrar hay que escribir el folio exacto: ${ejemplar.folio_interno}.` };
  }

  const cuantas = await solicitudesDe(ejemplar.id);
  if (cuantas > 0) {
    return {
      error: cuantas === 1
        ? 'Este ejemplar tiene una solicitud de adopción: no se borra, se da de baja.'
        : `Este ejemplar tiene ${cuantas} solicitudes de adopción: no se borra, se da de baja.`,
    };
  }

  const db = obtenerBase();

  // Respaldo completo antes de tocar nada.
  const completo = await db.prepare(`SELECT * FROM ejemplar WHERE id = ?`).bind(ejemplar.id).first();
  const { results: fotos } = await db
    .prepare(`SELECT * FROM fotografia WHERE ejemplar_id = ? ORDER BY orden`)
    .bind(ejemplar.id).all();

  await db
    .prepare(
      `INSERT INTO bitacora
         (entidad, entidad_id, accion, campo, valor_anterior, usuario_id, ocurrido_en, ip, respaldo)
       VALUES ('EJEMPLAR', ?, 'BAJA', 'borrado', ?, ?, ?, ?, ?)`
    )
    .bind(
      ejemplar.id,
      `${ejemplar.centro_origen_clave} · ${ejemplar.folio_interno} · ${ejemplar.nombre}`,
      persona.id, ahora(), ip,
      JSON.stringify({ ejemplar: completo, fotografias: fotos })
    )
    .run();

  // Los archivos primero; el registro después.
  if (typeof retirarFotos === 'function') {
    try { await retirarFotos(fotos); } catch { /* el registro se borra igual */ }
  }

  await db.prepare(`DELETE FROM ejemplar WHERE id = ?`).bind(ejemplar.id).run();

  return { ok: true, fotografias: fotos.length };
}

/** Historial de un ejemplar, para mostrarlo bajo el formulario. */
export async function historial(ejemplarId) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT b.accion, b.campo, b.valor_anterior, b.valor_nuevo, b.ocurrido_en,
              u.nombre AS usuario
         FROM bitacora b LEFT JOIN usuario u ON u.id = b.usuario_id
        WHERE b.entidad = 'EJEMPLAR' AND b.entidad_id = ?
        ORDER BY b.ocurrido_en DESC, b.id DESC
        LIMIT 30`
    )
    .bind(ejemplarId)
    .all();
  return results;
}
