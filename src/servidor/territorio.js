/* Territorio de la Ciudad de México.
 *
 * Las dieciséis alcaldías, que no cambian, y por eso viven en el código y no
 * en una tabla administrable: no hay nada que un administrador deba editar
 * aquí, y una lista fija no se puede desincronizar.
 *
 * Tiene además una función de regla, no sólo de comodidad: **el programa sólo
 * adopta a personas domiciliadas en la Ciudad de México**. Mientras la
 * alcaldía fue un campo de texto libre, esa condición dependía de que quien
 * revisara la solicitud se diera cuenta. Como lista cerrada, la impone el
 * sistema y se comprueba en el servidor.
 *
 * La clave es la que se guarda; la etiqueta es la que se lee. Se escriben
 * igual porque son nombres propios, pero se mantienen separadas por la misma
 * razón que en los demás catálogos: un día puede cambiar cómo se escribe un
 * nombre y no debe cambiar lo que está guardado.
 */
export const ALCALDIAS = [
  'Álvaro Obregón',
  'Azcapotzalco',
  'Benito Juárez',
  'Coyoacán',
  'Cuajimalpa de Morelos',
  'Cuauhtémoc',
  'Gustavo A. Madero',
  'Iztacalco',
  'Iztapalapa',
  'La Magdalena Contreras',
  'Miguel Hidalgo',
  'Milpa Alta',
  'Tláhuac',
  'Tlalpan',
  'Venustiano Carranza',
  'Xochimilco',
];

/** ¿Este texto es una de las dieciséis? Comparación exacta: lo que llega del
 *  formulario salió de la misma lista. */
export function esAlcaldiaDeLaCiudad(valor) {
  return ALCALDIAS.includes(String(valor ?? '').trim());
}
