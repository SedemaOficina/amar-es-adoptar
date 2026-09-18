/* Cuestionario de valoración de la solicitud de adopción.
 *
 * El texto es literal del documento de requerimientos (apartado 5). Vive
 * aquí, separado de las reglas y de la pantalla, por dos razones:
 *
 *   · Es contenido institucional. Corregir una redacción no debe obligar a
 *     entrar al código que valida ni al que dibuja el formulario.
 *   · La exportación a CSV y la pantalla de solicitudes recibidas necesitan
 *     las mismas etiquetas. Escribirlas dos veces es garantizar que un día
 *     dejen de coincidir.
 *
 * Las claves (A, B, C…) son las que se guardan en la base y las que salen en
 * el CSV. El texto puede cambiar; las claves no.
 */

/** Preguntas de opción única. */
export const PREGUNTAS_UNICAS = [
  {
    campo: 'p1',
    numero: 1,
    titulo: 'Atención veterinaria',
    enunciado: 'Ante una enfermedad o emergencia, ¿qué atención estarías dispuesto(a) a proporcionar al animal?',
    opciones: [
      ['A', 'Atención veterinaria siempre que sea necesaria, incluyendo estudios y tratamientos indicados.'],
      ['B', 'Atención veterinaria de acuerdo con mis posibilidades económicas; si supera mis recursos, buscaría alternativas para continuar su atención.'],
      ['C', 'Únicamente podría proporcionar atención veterinaria básica o preventiva.'],
      ['D', 'No podría comprometerme a proporcionar atención veterinaria.'],
    ],
  },
  {
    campo: 'p3',
    numero: 3,
    titulo: 'Actividad y convivencia',
    enunciado: '¿Cómo sería habitualmente la actividad y convivencia del animal contigo?',
    opciones: [
      ['A', 'Tendría paseos, juego y convivencia todos los días.'],
      ['B', 'Tendría paseos y actividad varios días por semana.'],
      ['C', 'Tendría actividad limitada y permanecería principalmente dentro de casa.'],
      ['D', 'Permanecería la mayor parte del tiempo con poca actividad o interacción.'],
    ],
  },
  {
    campo: 'p4',
    numero: 4,
    titulo: 'Experiencia con animales de compañía',
    enunciado: '¿Cuál describe mejor tu experiencia con animales de compañía?',
    opciones: [
      ['A', 'Actualmente tengo uno o más animales de compañía.'],
      ['B', 'He tenido animales anteriormente, pero actualmente no tengo.'],
      ['C', 'Sería mi primer animal de compañía.'],
      ['D', 'He convivido con animales, aunque nunca he sido directamente responsable de uno.'],
    ],
  },
  {
    campo: 'p5',
    numero: 5,
    titulo: 'Acuerdo dentro del hogar',
    enunciado: '¿Las personas que viven contigo están de acuerdo con incorporar un nuevo animal al hogar?',
    opciones: [
      ['A', 'Sí, todas están de acuerdo.'],
      ['B', 'Vivo solo(a).'],
      ['C', 'Algunas tienen dudas, pero están dispuestas a participar en el proceso de adopción.'],
      ['D', 'Alguna persona del hogar no está de acuerdo.'],
      ['E', 'Aún no lo he hablado con todas las personas del hogar.'],
    ],
  },
  {
    campo: 'p6',
    numero: 6,
    titulo: 'Compromiso con el proceso de adopción',
    enunciado: 'Si la adopción se concreta, ¿qué nivel de compromiso asumirías con el proceso?',
    opciones: [
      ['A', 'Acepto firmar el contrato de adopción y permitir el seguimiento posadopción.'],
      ['B', 'Acepto el contrato y el seguimiento, aunque tengo algunas dudas que quisiera aclarar previamente.'],
      ['C', 'Aceptaría firmar el contrato, pero no deseo seguimiento posterior.'],
      ['D', 'No estoy dispuesto(a) a firmar un contrato de adopción ni a aceptar seguimiento.'],
    ],
  },
  {
    campo: 'p7',
    numero: 7,
    titulo: 'Tipo de vivienda',
    enunciado: '¿En qué tipo de vivienda viviría el animal?',
    opciones: [
      ['A', 'Casa con espacio exterior propio.'],
      ['B', 'Casa sin espacio exterior propio.'],
      ['C', 'Departamento con balcón, terraza o espacio exterior propio.'],
      ['D', 'Departamento sin espacio exterior propio.'],
      ['E', 'Otro tipo de vivienda.'],
    ],
  },
  {
    campo: 'p9',
    numero: 9,
    titulo: 'Situación laboral y tiempo fuera de casa',
    enunciado: '¿Cuál describe mejor tu situación habitual de trabajo, estudio y tiempo fuera de casa?',
    opciones: [
      ['A', 'Trabajo o estudio principalmente desde casa.'],
      ['B', 'Trabajo o estudio fuera de casa medio tiempo, hasta aproximadamente 4 a 6 horas al día.'],
      ['C', 'Trabajo o estudio fuera de casa jornada completa, aproximadamente 6 a 8 horas al día.'],
      ['D', 'Trabajo o estudio fuera de casa más de 8 horas habitualmente.'],
      ['E', 'Trabajo de manera independiente o tengo horarios variables.'],
      ['F', 'Soy jubilado(a) o pensionado(a) y permanezco gran parte del tiempo en casa.'],
      ['G', 'Actualmente no trabajo ni estudio y permanezco gran parte del tiempo en casa.'],
      ['H', 'Otra situación.'],
    ],
  },
];

/* Preguntas de opción múltiple.
 *
 * Cada una tiene una opción que no admite compañía, declarada en `excluyente`
 * con su clave. Se declara en el dato y no se escribe en la pantalla porque
 * **la letra no existe para quien llena el formulario**: nadie ve una «G»,
 * ve un texto. Decirle «la opción G no puede combinarse» es hablarle en el
 * idioma de la base de datos. La pantalla toma de aquí el texto de esa opción
 * y lo nombra tal como se lee.
 *
 * La regla la impone además el esquema de la base, para que no dependa de que
 * el formulario valide bien. */
export const PREGUNTAS_MULTIPLES = [
  {
    prefijo: 'p2',
    numero: 2,
    excluyente: 'G',
    titulo: 'Cuidados durante toda su vida',
    enunciado: '¿Qué cuidados estás dispuesto(a) a proporcionar durante toda la vida del animal?',
    opciones: [
      ['A', 'Vacunación y desparasitación conforme a indicación veterinaria.'],
      ['B', 'Atención veterinaria cuando enferme.'],
      ['C', 'Alimentación adecuada.'],
      ['D', 'Ejercicio, paseos y estimulación.'],
      ['E', 'Educación y socialización.'],
      ['F', 'Esterilización cuando corresponda, o aceptar al animal ya esterilizado.'],
      ['G', 'No puedo comprometerme con todos estos cuidados.'],
    ],
  },
  {
    prefijo: 'p8',
    numero: 8,
    excluyente: 'G',
    titulo: 'Composición del hogar',
    enunciado: '¿Con quiénes conviviría habitualmente el animal?',
    opciones: [
      ['A', 'Adultos.'],
      ['B', 'Niños menores de 6 años.'],
      ['C', 'Niños de 6 a 12 años.'],
      ['D', 'Adolescentes de 13 a 17 años.'],
      ['E', 'Personas adultas mayores.'],
      ['F', 'Personas que requieren cuidados o asistencia especial.'],
      ['G', 'Vivo solo(a).'],
    ],
  },
];

export const LETRAS_MULTIPLES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

/** El texto de la opción que no admite compañía, para nombrarla en pantalla y
 *  en los mensajes de error en lugar de su letra. */
export function textoExcluyente(pregunta) {
  const par = pregunta.opciones.find(([clave]) => clave === pregunta.excluyente);
  return par ? par[1].replace(/\.$/, '') : '';
}

/** Claves admitidas por pregunta de opción única, derivadas del propio
 *  catálogo: no hay una segunda lista que se pueda desincronizar. */
export const CLAVES_UNICAS = Object.fromEntries(
  PREGUNTAS_UNICAS.map((p) => [p.campo, p.opciones.map(([clave]) => clave)])
);

export const CIERRE =
  'Completar este formulario no garantiza la adopción, pero nos permite acompañarte de ' +
  'forma cercana y responsable durante el proceso.';
