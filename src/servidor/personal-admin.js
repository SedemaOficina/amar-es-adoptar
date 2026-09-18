/* Personal con acceso al sistema — reglas.
 *
 * Quién puede entrar a la administración, con qué perfil y sobre qué centro.
 * Las reglas viven aquí y no en la pantalla (D-42): una regla escrita dentro
 * de una página no se puede probar, y la siguiente pantalla la olvidaría.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CÓMO SE RECONOCE A UNA PERSONA
 *
 * El proveedor de identidad (Llave CDMX) entrega un identificador propio de
 * cada persona. No se puede conocer ni teclear por adelantado: lo genera el
 * proveedor. Por eso el alta se hace con el CORREO con el que esa persona
 * entra al proveedor —el que sea: institucional, Gmail, el que use— y el
 * identificador se ata solo en su primer ingreso (ver `vincularPorCorreo`).
 *
 * Mientras no ha entrado nunca, `oidc_sub` guarda un marcador visible:
 *     pendiente:<correo>
 * No es un identificador real y nunca puede coincidir con uno, porque el
 * sistema rechaza cualquier identificador que llegue con ese prefijo.
 * ──────────────────────────────────────────────────────────────────────── */
import { obtenerBase } from './base-de-datos.js';

export const ROLES = [
  { clave: 'ADMIN_GLOBAL', etiqueta: 'Administración global',
    nota: 'Ve y edita los tres centros, y administra al personal.' },
  { clave: 'CAPTURISTA', etiqueta: 'Capturista de centro',
    nota: 'Ve y edita únicamente los ejemplares de su centro.' },
];

/** Prefijo del marcador que ocupa el lugar del identificador del proveedor
 *  mientras la persona no ha entrado nunca. */
export const MARCADOR = 'pendiente:';

export const esPendiente = (sub) => String(sub ?? '').startsWith(MARCADOR);

const limpiar = (v) => String(v ?? '').trim();
const ahora = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Sólo la administración global administra al personal.
 *  Corrige la debilidad 3 del inventario de ADIP, donde cualquier persona con
 *  acceso podía hacer cualquier cosa. */
export function puedeAdministrarPersonal(persona) {
  return persona?.rol === 'ADMIN_GLOBAL';
}

function exigirAdmin(persona) {
  if (!puedeAdministrarPersonal(persona)) {
    throw new Error('Sólo la administración global puede administrar al personal.');
  }
}

/* ---------------------------------------------------------------- consulta */

export async function listarPersonal() {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT u.id, u.oidc_sub, u.nombre, u.correo, u.rol, u.centro_clave,
              u.activo, u.creado_en, u.ultimo_acceso,
              c.etiqueta AS centro_etiqueta
         FROM usuario u
         LEFT JOIN centro c ON c.clave = u.centro_clave
        ORDER BY u.activo DESC, u.rol, u.nombre`
    )
    .all();

  return results.map((p) => ({ ...p, pendiente: esPendiente(p.oidc_sub) }));
}

export async function obtenerPersona(id) {
  const persona = await obtenerBase()
    .prepare(
      `SELECT u.id, u.oidc_sub, u.nombre, u.correo, u.rol, u.centro_clave,
              u.activo, u.creado_en, u.ultimo_acceso,
              c.etiqueta AS centro_etiqueta
         FROM usuario u
         LEFT JOIN centro c ON c.clave = u.centro_clave
        WHERE u.id = ?`
    )
    .bind(id)
    .first();

  return persona ? { ...persona, pendiente: esPendiente(persona.oidc_sub) } : null;
}

/** Cuántas personas con administración global quedan activas.
 *  Es el número que impide dejar al sistema sin quien lo administre. */
async function administradoresActivos() {
  const fila = await obtenerBase()
    .prepare(`SELECT COUNT(*) AS n FROM usuario WHERE rol = 'ADMIN_GLOBAL' AND activo = 1`)
    .first();
  return fila?.n ?? 0;
}

/* -------------------------------------------------------------- validación */

export async function validar(datos) {
  const errores = {};
  const valores = {};

  valores.nombre = limpiar(datos.nombre);
  if (!valores.nombre) errores.nombre = 'Falta el nombre de la persona.';
  else if (valores.nombre.length > 120) errores.nombre = 'El nombre es demasiado largo.';

  /* El correo se guarda en minúsculas. «Maria.Lopez@…» y «maria.lopez@…» son
     la misma persona, y si se guardaran distintos el reconocimiento del primer
     ingreso dependería de cómo lo escribió quien capturó. */
  valores.correo = limpiar(datos.correo).toLowerCase();
  if (!valores.correo) {
    errores.correo = 'Falta el correo.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo)) {
    errores.correo = 'Ese correo no parece válido.';
  } else if (valores.correo.length > 150) {
    errores.correo = 'El correo es demasiado largo.';
  }

  valores.rol = limpiar(datos.rol);
  if (!ROLES.some((r) => r.clave === valores.rol)) {
    errores.rol = 'Falta elegir el perfil.';
  }

  /* El centro no es un dato suelto: depende del perfil, y la base lo impone
     con una restricción propia. Una administración global no pertenece a
     ningún centro; un capturista no puede existir sin él. */
  const centro = limpiar(datos.centro_clave);
  if (valores.rol === 'CAPTURISTA') {
    if (!centro) {
      errores.centro_clave = 'Un capturista tiene que pertenecer a un centro.';
    } else {
      const existe = await obtenerBase()
        .prepare(`SELECT 1 AS hay FROM centro WHERE clave = ? AND activo = 1`)
        .bind(centro)
        .first();
      if (!existe) errores.centro_clave = 'Ese centro no existe.';
    }
    valores.centro_clave = centro || null;
  } else {
    valores.centro_clave = null;
  }

  return { errores, valores };
}

/** El índice único del correo salta como error de base. Se traduce a un
 *  mensaje del campo para que no llegue crudo a la pantalla. */
function traducirChoque(e) {
  const texto = String(e?.message ?? '');
  if (texto.includes('usuario_correo_unico') || texto.includes('UNIQUE')) {
    return { correo: 'Ya hay alguien registrado con ese correo.' };
  }
  return null;
}

/* ------------------------------------------------------------------- altas */

export async function crearPersona(quien, valores, ip) {
  exigirAdmin(quien);
  const db = obtenerBase();

  try {
    const { meta } = await db
      .prepare(
        `INSERT INTO usuario (oidc_sub, nombre, correo, rol, centro_clave, activo)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .bind(MARCADOR + valores.correo, valores.nombre, valores.correo,
            valores.rol, valores.centro_clave)
      .run();

    const id = meta.last_row_id;
    await apunte(db, id, 'ALTA', null, null,
                 `${valores.nombre} · ${valores.correo} · ${valores.rol}`, quien.id, ip).run();
    return { id };
  } catch (e) {
    const campo = traducirChoque(e);
    if (campo) return { errores: campo };
    throw e;
  }
}

/* ------------------------------------------------------------------ cambio */

export async function actualizarPersona(quien, id, valores, ip) {
  exigirAdmin(quien);
  const db = obtenerBase();

  const antes = await obtenerPersona(id);
  if (!antes) return { errores: { general: 'Esa persona ya no existe.' } };

  /* Si el sistema se quedara sin administración global no habría forma de
     volver a otorgarla: nadie podría entrar a la pantalla que la otorga. */
  if (antes.rol === 'ADMIN_GLOBAL' && valores.rol !== 'ADMIN_GLOBAL'
      && (await administradoresActivos()) <= 1 && antes.activo === 1) {
    return {
      errores: {
        rol: 'Es la única persona con administración global activa. ' +
             'Nombra a otra antes de cambiarle el perfil.',
      },
    };
  }

  /* Mientras no ha habido primer ingreso, el marcador tiene que seguir al
     correo: es lo único que ata ese renglón con quien va a entrar. */
  const sub = antes.pendiente ? MARCADOR + valores.correo : antes.oidc_sub;

  try {
    await db
      .prepare(
        `UPDATE usuario
            SET nombre = ?, correo = ?, rol = ?, centro_clave = ?, oidc_sub = ?
          WHERE id = ?`
      )
      .bind(valores.nombre, valores.correo, valores.rol, valores.centro_clave, sub, id)
      .run();
  } catch (e) {
    const campo = traducirChoque(e);
    if (campo) return { errores: campo };
    throw e;
  }

  const cambios = [
    ['nombre', antes.nombre, valores.nombre],
    ['correo', antes.correo, valores.correo],
    ['rol', antes.rol, valores.rol],
    ['centro_clave', antes.centro_clave, valores.centro_clave],
  ].filter(([, a, b]) => (a ?? '') !== (b ?? ''));

  if (cambios.length) {
    await db.batch(cambios.map(([campo, a, b]) =>
      apunte(db, id, 'CAMBIO', campo, a, b, quien.id, ip)));
  }

  return { id };
}

/* ------------------------------------------------- otorgar y retirar acceso */

/**
 * Retirar el acceso DESACTIVA, nunca borra.
 *
 * La bitácora apunta a `usuario.id` en cada alta, cambio y baja de ejemplar y
 * en cada acceso a datos personales. Borrar una persona rompería ese rastro,
 * que es justo lo que da valor a la bitácora. Una persona desactivada no entra
 * y sigue apareciendo en el historial de lo que hizo.
 */
export async function cambiarAcceso(quien, id, activo, ip) {
  exigirAdmin(quien);
  const db = obtenerBase();

  const antes = await obtenerPersona(id);
  if (!antes) return { errores: { general: 'Esa persona ya no existe.' } };
  if (antes.activo === (activo ? 1 : 0)) return { id };

  if (!activo) {
    /* Dos cerrojos. No son teóricos: los dos dejan al sistema sin forma de
       recuperarse, porque la pantalla que arregla el problema es la misma a
       la que ya nadie podría entrar. */
    if (Number(id) === Number(quien.id)) {
      return { errores: { general: 'No puedes retirarte el acceso a ti mismo.' } };
    }
    if (antes.rol === 'ADMIN_GLOBAL' && (await administradoresActivos()) <= 1) {
      return {
        errores: {
          general: 'Es la única persona con administración global activa. ' +
                   'Nombra a otra antes de retirarle el acceso.',
        },
      };
    }
  }

  await db
    .prepare(`UPDATE usuario SET activo = ? WHERE id = ?`)
    .bind(activo ? 1 : 0, id)
    .run();

  await apunte(db, id, activo ? 'ALTA' : 'BAJA', 'activo',
               String(antes.activo), activo ? '1' : '0', quien.id, ip).run();

  return { id };
}

/* ------------------------------------------------ atadura del primer ingreso */

/**
 * Ata el identificador del proveedor con el renglón que espera por su correo.
 *
 * Se llama en cada retorno del proveedor, ANTES de comprobar si la persona
 * tiene acceso. Devuelve el identificador con el que hay que seguir.
 *
 * Tres casos:
 *   · Ya hay un renglón con ese identificador → no hay nada que atar.
 *   · Hay un renglón pendiente con ese correo → se ata y queda atado.
 *   · No hay ninguno → la persona no tiene acceso, y eso lo resuelve quien
 *     llama. Aquí no se da de alta a nadie: identificarse no es tener acceso
 *     (D-36).
 */
export async function vincularPorCorreo(sub, correo) {
  /* Un identificador que llegue con el prefijo del marcador sería un intento
     de hacerse pasar por un renglón que todavía espera. No puede venir de un
     proveedor real; se rechaza sin más. */
  if (!sub || esPendiente(sub)) return null;

  const db = obtenerBase();

  const yaAtado = await db
    .prepare(`SELECT 1 AS hay FROM usuario WHERE oidc_sub = ?`)
    .bind(sub)
    .first();
  if (yaAtado) return sub;

  const limpio = limpiar(correo).toLowerCase();
  if (!limpio) return null;

  const esperando = await db
    .prepare(
      `SELECT id FROM usuario
        WHERE LOWER(correo) = ? AND oidc_sub LIKE ? || '%'`
    )
    .bind(limpio, MARCADOR)
    .first();
  if (!esperando) return null;

  await db
    .prepare(`UPDATE usuario SET oidc_sub = ? WHERE id = ?`)
    .bind(sub, esperando.id)
    .run();

  /* Queda constancia de cuándo dejó de estar pendiente: es el momento en que
     esa persona pasó de autorizada a operando. */
  await apunte(db, esperando.id, 'CAMBIO', 'oidc_sub', MARCADOR + limpio,
               'atado en el primer ingreso', esperando.id, null).run();

  return sub;
}

/**
 * SÓLO DESARROLLO — identificador que devolvería el proveedor para un correo.
 *
 * Un proveedor real entrega SIEMPRE el mismo identificador para la misma
 * persona: uno nuevo la primera vez, y ése mismo todas las veces siguientes.
 * La pantalla de acceso simulada tiene que comportarse igual, o probar la
 * atadura sería imposible: quien ya entró una vez no podría volver a entrar.
 *
 * Devuelve el identificador que ya tiene esa persona si dejó de estar
 * pendiente, y null si hay que inventar uno nuevo. Quien llama decide.
 */
export async function identificadorYaAtado(correo) {
  const limpio = limpiar(correo).toLowerCase();
  if (!limpio) return null;

  const fila = await obtenerBase()
    .prepare(`SELECT oidc_sub FROM usuario WHERE LOWER(correo) = ?`)
    .bind(limpio)
    .first();

  return fila && !esPendiente(fila.oidc_sub) ? fila.oidc_sub : null;
}

/* ---------------------------------------------------------------- bitácora */

function apunte(db, id, accion, campo, antes, despues, usuarioId, ip) {
  return db
    .prepare(
      `INSERT INTO bitacora (entidad, entidad_id, accion, campo, valor_anterior,
                             valor_nuevo, usuario_id, ocurrido_en, ip)
       VALUES ('USUARIO', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, accion, campo, antes, despues, usuarioId, ahora(), ip);
}

/** Historial de una persona, para su ficha. */
export async function historial(id) {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT b.accion, b.campo, b.valor_anterior, b.valor_nuevo, b.ocurrido_en,
              u.nombre AS quien
         FROM bitacora b
         LEFT JOIN usuario u ON u.id = b.usuario_id
        WHERE b.entidad = 'USUARIO' AND b.entidad_id = ?
        ORDER BY b.id DESC
        LIMIT 50`
    )
    .bind(id)
    .all();
  return results;
}
