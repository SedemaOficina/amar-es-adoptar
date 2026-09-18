/* Reglas de la solicitud de adopción.
 *
 * Todo lo que decide si una solicitud es válida, qué folio le toca y qué se
 * guarda vive aquí, no en la pantalla. Igual que `ejemplar-escritura.js` para
 * el registro de ejemplares (D-42): una regla escrita dentro de una página no
 * se puede probar y una pantalla nueva la olvidaría.
 */
import { obtenerBase } from './base-de-datos.js';
import {
  CLAVES_UNICAS, PREGUNTAS_MULTIPLES, LETRAS_MULTIPLES, textoExcluyente,
} from './cuestionario.js';
import { esAlcaldiaDeLaCiudad } from './territorio.js';

/* Campos del domicilio y contacto que la persona debe entregar. El proveedor
   los precarga, pero puede traerlos vacíos —no toda cuenta tiene domicilio—,
   así que el sistema los exige aquí y no da por hecho que vinieron. */
export const CONTACTO_OBLIGATORIO = [
  ['calle',              'la calle'],
  ['numero_exterior',    'el número exterior'],
  ['codigo_postal',      'el código postal'],
  ['alcaldia',           'la alcaldía'],
  ['colonia',            'la colonia'],
  ['telefono_celular',   'el teléfono celular'],
  ['correo_electronico', 'el correo electrónico'],
];

const limpiar = (v) => String(v ?? '').trim();

/** Valida lo que llegó del formulario. Devuelve { errores, valores }. */
export function validar(datos) {
  const errores = {};
  const valores = {};

  // --- Domicilio y contacto ---------------------------------------------
  for (const [campo, comoSeLlama] of CONTACTO_OBLIGATORIO) {
    valores[campo] = limpiar(datos[campo]);
    if (!valores[campo]) errores[campo] = `Falta ${comoSeLlama}.`;
  }
  valores.numero_interior = limpiar(datos.numero_interior); // opcional

  if (valores.codigo_postal && !/^\d{5}$/.test(valores.codigo_postal)) {
    errores.codigo_postal = 'El código postal son cinco dígitos.';
  }

  /* El programa adopta a personas domiciliadas en la Ciudad de México. La
     alcaldía llega de una lista cerrada, así que lo único que puede traer un
     valor distinto es una petición armada a mano: se rechaza aquí, no en la
     pantalla. */
  if (valores.alcaldia && !esAlcaldiaDeLaCiudad(valores.alcaldia)) {
    errores.alcaldia = 'Elige una alcaldía de la Ciudad de México.';
  }

  const telefono = valores.telefono_celular.replace(/[\s()-]/g, '');
  if (valores.telefono_celular && !/^\d{10}$/.test(telefono)) {
    errores.telefono_celular = 'El teléfono celular son diez dígitos.';
  } else {
    valores.telefono_celular = telefono;
  }

  if (valores.correo_electronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo_electronico)) {
    errores.correo_electronico = 'Ese correo electrónico no parece válido.';
  }

  // --- Preguntas de opción única ----------------------------------------
  for (const [campo, claves] of Object.entries(CLAVES_UNICAS)) {
    const respuesta = limpiar(datos[campo]);
    if (!claves.includes(respuesta)) {
      errores[campo] = 'Falta responder esta pregunta.';
    } else {
      valores[campo] = respuesta;
    }
  }

  // --- Preguntas de opción múltiple -------------------------------------
  for (const { prefijo, numero } of PREGUNTAS_MULTIPLES) {
    let marcadas = 0;
    for (const letra of LETRAS_MULTIPLES) {
      const campo = `${prefijo}_${letra}`;
      valores[campo] = datos[campo] ? 1 : 0;
      marcadas += valores[campo];
    }

    if (marcadas === 0) {
      errores[prefijo] = 'Elige al menos una opción.';
    } else if (valores[`${prefijo}_g`] === 1 && marcadas > 1) {
      const cual = textoExcluyente(PREGUNTAS_MULTIPLES.find((p) => p.prefijo === prefijo));
      errores[prefijo] =
        `En la pregunta ${numero}, «${cual}» no puede combinarse con las demás.`;
    }
  }

  // --- Aviso de privacidad ----------------------------------------------
  // Es consentimiento informado sobre datos personales: sin él no hay trámite.
  if (!datos.acepta_aviso) {
    errores.acepta_aviso = 'Para enviar la solicitud hay que aceptar el aviso de privacidad.';
  }

  return { errores, valores };
}

/** ¿Esta persona ya solicitó a este ejemplar? Devuelve la solicitud previa. */
export async function solicitudPrevia(llaveSub, ejemplarId) {
  return obtenerBase()
    .prepare(
      `SELECT folio, recibida_en FROM solicitud
        WHERE llave_sub = ? AND ejemplar_id = ?
        ORDER BY id DESC LIMIT 1`
    )
    .bind(llaveSub, ejemplarId)
    .first();
}

/* Folio de trazabilidad: AAAA-NNNNNN, consecutivo dentro del año.
 * Se calcula a partir del mayor folio existente del año en curso. Si dos
 * solicitudes coincidieran en el mismo instante, la restricción UNIQUE de la
 * base rechazaría la segunda; por eso quien llama reintenta. */
async function siguienteFolio() {
  const anio = new Date().getUTCFullYear();
  const fila = await obtenerBase()
    .prepare(`SELECT MAX(folio) AS ultimo FROM solicitud WHERE folio LIKE ?`)
    .bind(`${anio}-%`)
    .first();

  const consecutivo = fila?.ultimo ? Number(String(fila.ultimo).slice(5)) + 1 : 1;
  return `${anio}-${String(consecutivo).padStart(6, '0')}`;
}

/**
 * Registra la solicitud. Guarda una instantánea del ejemplar tal como estaba
 * al momento del envío: si después lo trasladan o le cambian el nombre, la
 * solicitud sigue diciendo a qué animal se refería.
 *
 * No toca la condición del ejemplar. Quien decide si pasa a «En proceso» es
 * el personal del centro, no el sistema.
 */
export async function crear({ ejemplar, solicitante, valores }) {
  const db = obtenerBase();

  const esFicticio = solicitante.simulada || ejemplar.es_ficticio ? 1 : 0;

  const campos = [
    'folio', 'es_ficticio', 'ejemplar_id',
    'snap_folio_interno', 'snap_centro_origen', 'snap_centro_actual', 'snap_semaforo',
    'snap_nombre', 'snap_edad', 'snap_sexo', 'snap_talla', 'snap_condicion',
    'llave_sub', 'nombres', 'primer_apellido', 'segundo_apellido', 'curp',
    'calle', 'numero_exterior', 'numero_interior', 'codigo_postal', 'alcaldia', 'colonia',
    'telefono_celular', 'correo_electronico',
    'p1',
    'p2_a', 'p2_b', 'p2_c', 'p2_d', 'p2_e', 'p2_f', 'p2_g',
    'p3', 'p4', 'p5', 'p6', 'p7',
    'p8_a', 'p8_b', 'p8_c', 'p8_d', 'p8_e', 'p8_f', 'p8_g',
    'p9',
  ];

  // Dos intentos: el segundo cubre el caso improbable de que otra solicitud
  // se lleve el folio entre el cálculo y la escritura.
  for (let intento = 0; intento < 2; intento++) {
    const folio = await siguienteFolio();

    const fila = {
      folio,
      es_ficticio: esFicticio,
      ejemplar_id: ejemplar.id,
      snap_folio_interno: ejemplar.folio_interno,
      snap_centro_origen: ejemplar.centro_origen_clave,
      snap_centro_actual: ejemplar.centro_actual_clave,
      snap_semaforo: ejemplar.semaforo,
      snap_nombre: ejemplar.nombre,
      snap_edad: ejemplar.edad_clave,
      snap_sexo: ejemplar.sexo_clave,
      snap_talla: ejemplar.talla_clave,
      snap_condicion: ejemplar.condicion,
      llave_sub: solicitante.sub,
      nombres: solicitante.nombres,
      primer_apellido: solicitante.primer_apellido,
      segundo_apellido: solicitante.segundo_apellido || null,
      curp: solicitante.curp,
      ...valores,
    };

    try {
      await db
        .prepare(
          `INSERT INTO solicitud (${campos.join(', ')})
           VALUES (${campos.map(() => '?').join(', ')})`
        )
        .bind(...campos.map((c) => fila[c] ?? null))
        .run();

      return { folio };
    } catch (e) {
      const repetido = String(e.message ?? '').includes('solicitud.folio');
      if (!repetido || intento === 1) throw e;
    }
  }
}

/** Datos de una solicitud para la pantalla de confirmación. */
export async function obtenerPorFolio(folio, llaveSub) {
  return obtenerBase()
    .prepare(
      `SELECT folio, recibida_en, snap_nombre, correo_electronico, es_ficticio
         FROM solicitud WHERE folio = ? AND llave_sub = ?`
    )
    .bind(folio, llaveSub)
    .first();
}
