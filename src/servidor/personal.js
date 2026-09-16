/* Consulta del personal administrador contra la base de datos.
 *
 * Toda petición a una página de administración pasa por aquí. El perfil y el
 * centro NO viajan en la cookie: se leen de la base cada vez, para que una
 * baja o un cambio de adscripción surtan efecto de inmediato.
 */
import { obtenerBase } from './base-de-datos.js';

/** Devuelve la persona si existe y está activa; null en cualquier otro caso. */
export async function obtenerPersonaActiva(sub) {
  if (!sub) return null;

  const persona = await obtenerBase()
    .prepare(
      `SELECT u.id, u.oidc_sub, u.nombre, u.correo, u.rol, u.centro_clave,
              c.etiqueta AS centro_etiqueta
         FROM usuario u
         LEFT JOIN centro c ON c.clave = u.centro_clave
        WHERE u.oidc_sub = ? AND u.activo = 1`
    )
    .bind(sub)
    .first();

  return persona ?? null;
}

/** Personal de prueba, para la pantalla de acceso simulada del entorno de
 *  desarrollo. Sólo devuelve los identificadores que empiezan con 'dev-'. */
export async function listarPersonalDePrueba() {
  const { results } = await obtenerBase()
    .prepare(
      `SELECT u.oidc_sub, u.nombre, u.rol, c.etiqueta AS centro_etiqueta
         FROM usuario u
         LEFT JOIN centro c ON c.clave = u.centro_clave
        WHERE u.activo = 1 AND u.oidc_sub LIKE 'dev-%'
        ORDER BY u.rol, u.nombre`
    )
    .all();

  return results;
}

export async function registrarAcceso(id) {
  await obtenerBase()
    .prepare(`UPDATE usuario SET ultimo_acceso = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`)
    .bind(id)
    .run();
}
