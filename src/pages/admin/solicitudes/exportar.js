/* Descarga de las solicitudes en CSV.
 *
 * El alcance se aplica en la consulta: un capturista descarga únicamente las
 * solicitudes de su centro. Y la descarga queda registrada en bitácora, igual
 * que abrir una ficha: bajarse el archivo completo es el acceso a datos
 * personales más amplio que ofrece el sistema.
 */
export const prerender = false;

import { obtenerBase } from '../../../servidor/base-de-datos.js';
import { exportarCSV, nombreArchivoCSV } from '../../../servidor/solicitudes-admin.js';

export async function GET({ locals, request }) {
  const persona = locals.persona;
  const { contenido, total } = await exportarCSV(persona);

  await obtenerBase()
    .prepare(
      `INSERT INTO bitacora (entidad, entidad_id, accion, campo, valor_nuevo, usuario_id, ocurrido_en, ip)
       VALUES ('SOLICITUD', 0, 'ACCESO_DATO_PERSONAL', 'exportacion', ?, ?, ?, ?)`
    )
    .bind(
      `${total} solicitudes`,
      persona.id,
      new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      request.headers.get('cf-connecting-ip')
    )
    .run();

  return new Response(contenido, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivoCSV()}"`,
      'Cache-Control': 'no-store',
    },
  });
}
