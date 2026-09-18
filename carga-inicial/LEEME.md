# Carga inicial del padrón

Esta carpeta existe para una sola cosa: meter a la base los ejemplares que ya existen en
los centros, **una vez**. No es una función del sistema: no hay pantalla, no hay botón, y
nada de `src/` importa nada de aquí. Los ejemplares que se den de alta después de ese
arranque se capturan en el formulario de la administración, uno por uno.

## Por qué hace falta un guion y no basta un archivo SQL

Los cuatro tamaños de cada fotografía los genera el navegador de quien sube, no el
servidor (está explicado en `src/servidor/fotografias.js`). Fue la decisión correcta para
la captura diaria, pero tiene una consecuencia: **una carga desde código no tiene
navegador**, y una migración SQL no puede escribir en el almacén de objetos. Sin el guion
no existe ningún camino para meter cientos de fotografías.

`preparar.mjs` reproduce en el escritorio exactamente el mismo recorte que hace el
navegador —proporción 4:3 con encuadre superior— para que una fotografía cargada así y una
subida desde la pantalla queden idénticas.

## Las dos reglas que el guion hace valer

La carga entra por debajo de las pantallas, así que ninguna validación del formulario la
detiene. El guion las repite por su cuenta:

- **D-107. No hay registro sin fotografía.** Un renglón sin al menos una imagen emparejada
  se rechaza. No es una recomendación: una ficha sin imagen ocupa un lugar en el catálogo
  sin darle oportunidad al animal.
- **D-118. Al programa sólo ingresan ejemplares en verde.** La columna `SEMAFORO` no se
  captura. Si trae cualquier otro valor, el renglón se rechaza.

Y una tercera, de método: **comprueba todo antes de escribir nada.** Si hay un solo
renglón malo no genera ningún archivo y enumera los problemas con su número de renglón.
Nunca deja una carga a medias.

## Qué se entrega

### 1. La plantilla

`plantilla-ejemplares.csv`, un ejemplar por renglón. No cambies el renglón de encabezados
ni el orden de las columnas.

| Columna | Obligatoria | Valores admitidos |
|---|---|---|
| `CENTRO_ORIGEN` | Sí | `BVA` · `AJUSCO` · `GALEANA` |
| `FOLIO_INTERNO` | Sí | Cinco dígitos, con ceros a la izquierda: `00147` |
| `CENTRO_ACTUAL` | No | Uno de los tres centros. Vacío equivale al de origen. Sólo se llena cuando el ejemplar fue trasladado. |
| `NOMBRE` | Sí | Texto libre |
| `EDAD` | Sí | `JOVEN` · `ADULTO` · `GERIATRA` |
| `SEXO` | Sí | `HEMBRA` · `MACHO` |
| `TALLA` | Sí | `CHICO` · `MEDIANO` · `GRANDE` |
| `SEMAFORO` | — | **No se captura.** Se deja vacío. |
| `CONDICION` | No | `DISPONIBLE` · `EN_PROCESO` · `ADOPTADO`. Vacío equivale a `DISPONIBLE`. No se admite `BAJA`. |

Dos advertencias que evitan rehacer el trabajo:

1. **Excel se come los ceros a la izquierda.** `00147` se convierte en `147` y la base lo
   rechaza. Antes de capturar, selecciona la columna `FOLIO_INTERNO` y dale formato de
   **Texto**. Al guardar, elige **CSV UTF-8 (delimitado por comas)**.
2. **El folio no puede repetirse dentro del mismo centro.** Entre centros distintos sí:
   `AJUSCO 00147` y `BVA 00147` son dos ejemplares diferentes y ambos son válidos. Por eso
   el nombre de cada fotografía lleva el centro además del folio.

### 2. Las fotografías

En `fotografias/`, nombradas `CENTRO-FOLIO-N.jpg`:

```
BVA-00147-1.jpg      primera fotografía, la que sale de portada
BVA-00147-2.jpg
AJUSCO-00147-1.jpg   otro animal: mismo folio, distinto centro
```

Hasta tres por ejemplar. Se admiten `.jpg`, `.jpeg`, `.png` y `.webp` de cualquier tamaño:
el guion las recorta y las convierte. Si vienen de teléfono, no hay que enderezarlas a
mano — la orientación se aplica sola.

El contenido de esta carpeta no se versiona: son datos de operación y pesan.

## Cómo se corre

Ventana de PowerShell en la carpeta del proyecto, con el servidor de desarrollo apagado o
en otra ventana:

```
node carga-inicial/preparar.mjs
```

Genera `carga-inicial/salida/` con tres cosas:

| | Qué es |
|---|---|
| `0012_carga_inicial.sql` | La migración: los renglones de `ejemplar`, `fotografia` y `bitacora`. |
| `objetos/` | Los cuatro tamaños de cada fotografía, ya con la ruta que tendrán en el almacén. |
| `claves.txt` | La lista de rutas, para el paso de subida. |

**No sube nada ni toca ninguna base.** Es a propósito: puedes revisar lo que se va a cargar
antes de cargarlo. Si `salida` ya tiene una preparación anterior, el guion se detiene y
te pide moverla a `a borrar`; no la sobrescribe, para que nunca pierdas la posibilidad de
comparar dos preparaciones. Una carpeta `salida` vacía no estorba: lo que se comprueba es
el contenido, no la carpeta.

### El identificador inicial

Los identificadores van escritos en la migración y no los asigna la base, porque las rutas
de las fotografías se construyen con ellos. Por omisión empieza en 1, que es lo correcto
sobre una base recién creada. Si la base ya tiene ejemplares reales, mira cuál es el
último y arranca después:

```
node carga-inicial/preparar.mjs --desde-id 41
```

Si alguno de esos números ya está ocupado, la migración falla al primer `INSERT`. Eso es
deseable: quiere decir que la base no estaba donde se creía.

## El ensayo

`prueba/` trae una plantilla de tres renglones y seis imágenes generadas —una horizontal,
una vertical, una cuadrada, una chica, una huérfana y una mal nombrada— para comprobar que
el guion corre antes de tocar el padrón real:

```
node carga-inicial/preparar.mjs carga-inicial/prueba
```

Cada imagen de ensayo lleva una franja **morada con un triángulo blanco arriba** y una
franja **gris con un círculo blanco abajo**. Son figuras y no texto a propósito: el texto
de un SVG desaparece sin avisar en una máquina sin tipografías instaladas, y una
comprobación que falla en silencio es peor que ninguna.

Abre después `prueba/salida/objetos/ejemplar/1/` y compara las dos fotografías:

| | Venía | Debe quedar |
|---|---|---|
| `1-…` | horizontal | triángulo arriba **y** círculo abajo: el recorte fue a los lados |
| `2-…` | vertical | triángulo arriba, **sin** franja gris: se tiró la parte de abajo |

Eso es el encuadre superior, la corrección al defecto de la plataforma de ADIP, que
recorta al centro y decapita a los perros en fotos verticales. Si la vertical conserva el
círculo, o si alguna perdió el triángulo, el recorte está invertido.

## Qué sigue después

La subida al almacén y la aplicación de la migración. Se documenta en `DESPLIEGUE.md`
cuando esté hecho.

Dos advertencias que ya se conocen y que ahí se repiten:

- `wrangler d1 execute --remote --file=…` **no funciona**: devuelve `Authentication error
  [code: 10000]`. Las migraciones remotas se aplican con `wrangler d1 migrations apply
  amar-es-adoptar --remote`, y para eso el archivo tiene que estar en `migraciones/`.
- Primero local, se revisa el catálogo completo en el navegador, y **sólo entonces**
  remoto.
