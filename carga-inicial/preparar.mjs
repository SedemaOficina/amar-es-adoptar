/* Carga inicial del padrón — preparación.
 *
 * QUÉ ES ESTO Y QUÉ NO ES
 *
 * No es una función de la plataforma. Es una herramienta de arranque que se
 * corre UNA VEZ, en una máquina, para meter a la base los ejemplares que ya
 * existen en los centros. Por eso vive en `carga-inicial/` y no en `src/`:
 * nada del sistema lo importa, y quien reciba el proyecto puede leerlo,
 * correrlo y olvidarlo.
 *
 * POR QUÉ HACE FALTA
 *
 * Los cuatro tamaños de cada fotografía los genera el navegador de quien sube
 * (ver `src/cliente/fotografias.js`). Fue la decisión correcta para la captura
 * diaria, pero tiene una consecuencia: una carga desde código no tiene
 * navegador. Y una migración SQL no puede escribir en el almacén de objetos.
 * Así que sin este guion no existe ningún camino para meter cientos de fotos.
 *
 * Este archivo reproduce, en el servidor, exactamente el mismo recorte que
 * hace el navegador —proporción 4:3 con encuadre superior— para que una
 * fotografía cargada aquí y una subida desde la pantalla queden idénticas.
 *
 * QUÉ HACE, EN ORDEN
 *
 *   1. Lee la plantilla y la carpeta de fotografías.
 *   2. Comprueba TODO antes de escribir NADA. Si hay un solo renglón malo,
 *      no genera nada y te dice qué está mal, renglón por renglón.
 *   3. Genera los cuatro tamaños de cada fotografía en `salida/objetos/`,
 *      con la misma ruta que tendrán en el almacén.
 *   4. Escribe `salida/0012_carga_inicial.sql`, la migración con los
 *      renglones de `ejemplar`, `fotografia` y `bitacora`.
 *
 * NO sube nada ni toca ninguna base. Eso es el paso siguiente, y es a
 * propósito: así puedes revisar lo que se va a cargar antes de cargarlo.
 *
 * LAS DOS REGLAS QUE HACE VALER
 *
 *   · D-107. No hay registro sin fotografía. Un renglón sin al menos una
 *     imagen emparejada se rechaza. Entra por debajo de las pantallas, así
 *     que ninguna validación del formulario lo detendría.
 *   · D-118. Al programa sólo ingresan ejemplares en verde. La columna
 *     SEMAFORO no se captura; si trae cualquier otra cosa, se rechaza.
 *
 * CÓMO SE CORRE
 *
 *   node carga-inicial/preparar.mjs
 *   node carga-inicial/preparar.mjs --desde-id 1
 *   node carga-inicial/preparar.mjs carga-inicial/prueba   (ensayo)
 */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/* Los cuatro tamaños se leen del archivo compartido, no se copian aquí.
   Dos copias de una medida acaban siempre en una discrepancia. */
import { TAMANOS, MAXIMO_POR_EJEMPLAR } from '../src/compartido/fotografias-medidas.js';

/* `fileURLToPath` y no `new URL(...).pathname`: en Windows el segundo devuelve
   «/C:/Users/…», con una diagonal de sobra al principio, y ninguna ruta
   construida a partir de eso abre. */
const AQUI = dirname(fileURLToPath(import.meta.url));

/* Argumentos. Dos, los dos opcionales:
     · una carpeta de trabajo, para poder ensayar con material de prueba en
       `carga-inicial/prueba/` sin ensuciar la plantilla real;
     · --desde-id N, el primer identificador que se asignará. */
function leerArgumentos() {
  const args = process.argv.slice(2);
  let carpeta = null, desdeId = 1;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--desde-id') desdeId = Number(args[++i]);
    else if (a.startsWith('--desde-id=')) desdeId = Number(a.slice('--desde-id='.length));
    else if (a.startsWith('--')) { console.error(`No conozco la opción «${a}».`); process.exit(1); }
    else if (carpeta === null) carpeta = a;
    else { console.error('Sobra un argumento: la carpeta de trabajo es una sola.'); process.exit(1); }
  }

  if (!Number.isInteger(desdeId) || desdeId < 1) {
    console.error('El valor de --desde-id tiene que ser un número entero mayor que cero.');
    process.exit(1);
  }
  return { carpeta: resolve(carpeta ?? AQUI), desdeId };
}

const { carpeta: CARPETA, desdeId: DESDE_ID } = leerArgumentos();
const PLANTILLA  = join(CARPETA, 'plantilla-ejemplares.csv');
const FOTOS      = join(CARPETA, 'fotografias');
const SALIDA     = join(CARPETA, 'salida');
const MIGRACION  = '0012_carga_inicial.sql';

/* Catálogos. Son los mismos que tiene la base; si allá cambian, aquí también.
   Se escriben a mano a propósito: el guion no se conecta a ninguna base, y
   así puede correrse sin credenciales ni red. */
const CENTROS     = ['BVA', 'AJUSCO', 'GALEANA'];
const EDADES      = ['JOVEN', 'ADULTO', 'GERIATRA'];
const SEXOS       = ['HEMBRA', 'MACHO'];
const TALLAS      = ['CHICO', 'MEDIANO', 'GRANDE'];
const CONDICIONES = ['DISPONIBLE', 'EN_PROCESO', 'ADOPTADO'];
const COLUMNAS    = ['CENTRO_ORIGEN', 'FOLIO_INTERNO', 'CENTRO_ACTUAL', 'NOMBRE',
                     'EDAD', 'SEXO', 'TALLA', 'SEMAFORO', 'CONDICION'];

/* ------------------------------------------------------------------ */
/* Lectura del CSV                                                     */
/* ------------------------------------------------------------------ */

/* Un analizador de CSV de veinte líneas, en lugar de una dependencia.
   Entiende lo único que Excel produce y que importa aquí: campos entre
   comillas, comas dentro de comillas, y comillas dobles escapadas (""). */
function leerCsv(texto) {
  const limpio = texto.replace(/^﻿/, '');   // Excel escribe una marca al inicio
  const renglones = [];
  let campo = '', fila = [], entreComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); renglones.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); renglones.push(fila); }

  return renglones.filter((f) => f.some((v) => v.trim() !== ''));
}

/* ------------------------------------------------------------------ */
/* Fotografías                                                         */
/* ------------------------------------------------------------------ */

/* Nombre de archivo esperado: CENTRO-FOLIO-N.jpg  →  BVA-00147-1.jpg
   El centro va en el nombre porque el folio SOLO es único dentro de su
   centro: AJUSCO 00147 y BVA 00147 son dos animales distintos. */
const PATRON_FOTO = /^(BVA|AJUSCO|GALEANA)-(\d{5})-([1-3])\.(jpe?g|png|webp)$/i;

async function agruparFotografias() {
  let archivos;
  try {
    archivos = await readdir(FOTOS);
  } catch {
    return { grupos: new Map(), sueltas: [], sinCarpeta: true };
  }

  const grupos = new Map();   // "CENTRO FOLIO" → [{orden, archivo}]
  const sueltas = [];

  for (const nombre of archivos) {
    if (nombre.startsWith('.')) continue;
    const m = PATRON_FOTO.exec(nombre);
    if (!m) { sueltas.push(nombre); continue; }

    const llave = `${m[1].toUpperCase()} ${m[2]}`;
    if (!grupos.has(llave)) grupos.set(llave, []);
    grupos.get(llave).push({ orden: Number(m[3]), archivo: nombre });
  }

  for (const lista of grupos.values()) lista.sort((a, b) => a.orden - b.orden);
  return { grupos, sueltas, sinCarpeta: false };
}

/* El mismo recorte que hace el navegador, explicado en cliente/fotografias.js:
     horizontal → se recorta a los lados, centrado;
     vertical   → se recorta por abajo, conservando la parte de arriba, que es
                  donde está la cabeza del animal.
   `.rotate()` sin argumentos aplica la orientación EXIF: las fotos de teléfono
   vienen giradas y el navegador ya las endereza solo. Sin esta línea, la misma
   foto quedaría acostada aquí y de pie allá. */
async function generarTamanos(rutaOrigen) {
  const base = sharp(rutaOrigen).rotate();
  const meta = await base.metadata();
  const ancho = meta.autoOrient?.width  ?? meta.width;
  const alto  = meta.autoOrient?.height ?? meta.height;

  const salidas = {};
  let bytesOriginal = 0;

  for (const t of TAMANOS) {
    const proporcion = t.ancho / t.alto;
    let corte;
    if (ancho / alto > proporcion) {
      const w = Math.round(alto * proporcion);
      corte = { left: Math.round((ancho - w) / 2), top: 0, width: w, height: alto };
    } else {
      corte = { left: 0, top: 0, width: ancho, height: Math.round(ancho / proporcion) };
    }

    const buffer = await sharp(rutaOrigen)
      .rotate()
      .extract(corte)
      .resize(t.ancho, t.alto, { fit: 'fill' })
      .jpeg({ quality: Math.round(t.calidad * 100) })
      .toBuffer();

    salidas[t.nombre] = buffer;
    if (t.nombre === 'original') bytesOriginal = buffer.length;
  }

  return { salidas, ancho, alto, bytes: bytesOriginal };
}

/* ------------------------------------------------------------------ */
/* Identificadores                                                     */
/* ------------------------------------------------------------------ */

/* Mismo formato que `generarSlug` en el servidor: nombre normalizado más
   cuatro caracteres al azar. La unicidad se comprueba contra lo generado en
   esta misma corrida; la base la vuelve a comprobar por su cuenta al aplicar
   la migración, porque la columna es UNIQUE. */
function generarSlug(nombre, usados) {
  const base = nombre
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ejemplar';

  for (let intento = 0; intento < 20; intento++) {
    const candidato = `${base}-${randomBytes(2).toString('hex')}`;
    if (!usados.has(candidato)) { usados.add(candidato); return candidato; }
  }
  throw new Error(`No se pudo generar un identificador único para «${nombre}».`);
}

/* El sello de la ruta se deriva del centro, el folio y el orden, no de la hora.
   Así, si tienes que volver a correr el guion —porque una foto salió mal o la
   subida se interrumpió a la mitad—, las rutas salen idénticas y la segunda
   subida SUSTITUYE los archivos en lugar de dejar dos juegos y que nadie sepa
   cuál apunta la base. */
function sello(centro, folio, orden) {
  return createHash('sha256').update(`${centro}|${folio}|${orden}`).digest('hex').slice(0, 8);
}

function ruta(ejemplarId, orden, tamano, s) {
  return `ejemplar/${ejemplarId}/${orden}-${tamano}-${s}.jpg`;
}

/* ------------------------------------------------------------------ */
/* SQL                                                                 */
/* ------------------------------------------------------------------ */

/* Comillas simples duplicadas: la única forma de escapar texto en SQLite.
   El guion no usa parámetros porque su producto es un archivo, no una
   conexión, así que esto tiene que estar bien. */
const txt = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

/* ------------------------------------------------------------------ */
/* Programa                                                            */
/* ------------------------------------------------------------------ */

/* ¿Hay algo dentro? Se pregunta por el CONTENIDO y no por la carpeta: una
   carpeta vacía no guarda ninguna preparación anterior que se pueda perder, y
   Windows deja el esqueleto de directorios cuando se saca el contenido a mano.
   Negarse ante una carpeta vacía sería una traba sin nada que proteger. */
async function tieneContenido(ruta) {
  try {
    for (const entrada of await readdir(ruta, { withFileTypes: true })) {
      if (entrada.isDirectory()) { if (await tieneContenido(join(ruta, entrada.name))) return true; }
      else return true;
    }
    return false;
  } catch { return false; }
}

async function main() {
  const desdeId = DESDE_ID;

  /* No se sobrescribe ni se borra nada: si ya hay una salida anterior, se
     detiene y te pide moverla. Una corrida que pisa la anterior en silencio
     es la forma más fácil de subir a producción algo que creías haber
     descartado. */
  if (await tieneContenido(SALIDA)) {
    console.error(
      `\nYa hay una preparación anterior en «${SALIDA}».\n` +
      `Muévela a «a borrar» y vuelve a correr el guion.\n` +
      `No la sobrescribo: perderías la posibilidad de comparar las dos, y una\n` +
      `corrida que pisa a la anterior en silencio es la forma más fácil de subir\n` +
      `a producción algo que creías haber descartado.\n`
    );
    process.exit(1);
  }

  const crudo = await readFile(PLANTILLA, 'utf8').catch(() => null);
  if (crudo === null) {
    console.error(`No encontré «${PLANTILLA}».`);
    process.exit(1);
  }

  const renglones = leerCsv(crudo);
  if (renglones.length < 2) {
    console.error('La plantilla no tiene ningún ejemplar capturado.');
    process.exit(1);
  }

  const encabezado = renglones[0].map((c) => c.trim().toUpperCase());
  if (encabezado.join(',') !== COLUMNAS.join(',')) {
    console.error(
      `\nEl renglón de encabezados no es el esperado.\n` +
      `  Esperaba: ${COLUMNAS.join(', ')}\n` +
      `  Encontré: ${encabezado.join(', ')}\n` +
      `No cambies ni el orden ni los nombres de las columnas.\n`
    );
    process.exit(1);
  }

  const { grupos, sueltas, sinCarpeta } = await agruparFotografias();
  if (sinCarpeta) {
    console.error(`No encontré la carpeta «${FOTOS}».`);
    process.exit(1);
  }

  /* ---- Comprobación completa, antes de escribir nada ---- */

  const problemas = [];
  const vistos = new Map();       // "CENTRO FOLIO" → número de renglón
  const usados = new Set();       // slugs de esta corrida
  const listos = [];

  for (let i = 1; i < renglones.length; i++) {
    const n = i + 1;                       // número de renglón como lo ve Excel
    const f = renglones[i].map((c) => c.trim());
    const mal = (t) => problemas.push(`Renglón ${n}: ${t}`);

    const [centroOrigen, folio, centroActualCrudo, nombre,
           edad, sexo, talla, semaforo, condicionCruda] = f;

    if (!CENTROS.includes(centroOrigen)) mal(`CENTRO_ORIGEN «${centroOrigen}» no existe. Válidos: ${CENTROS.join(', ')}.`);
    if (!/^\d{5}$/.test(folio)) mal(`FOLIO_INTERNO «${folio}» no son cinco dígitos. Dale formato de Texto a la columna en Excel.`);
    if (!nombre) mal('NOMBRE está vacío.');
    if (!EDADES.includes(edad)) mal(`EDAD «${edad}» no existe. Válidas: ${EDADES.join(', ')}.`);
    if (!SEXOS.includes(sexo)) mal(`SEXO «${sexo}» no existe. Válidos: ${SEXOS.join(', ')}.`);
    if (!TALLAS.includes(talla)) mal(`TALLA «${talla}» no existe. Válidas: ${TALLAS.join(', ')}.`);

    // D-118: al programa sólo ingresan ejemplares en verde.
    if (semaforo && semaforo.toUpperCase() !== 'VERDE') {
      mal(`SEMAFORO «${semaforo}». Esta columna no se captura: al programa sólo ingresan ejemplares en verde.`);
    }

    const centroActual = centroActualCrudo || centroOrigen;
    if (!CENTROS.includes(centroActual)) mal(`CENTRO_ACTUAL «${centroActualCrudo}» no existe.`);

    const condicion = condicionCruda || 'DISPONIBLE';
    if (!CONDICIONES.includes(condicion)) {
      mal(`CONDICION «${condicionCruda}» no se admite en la carga inicial. Válidas: ${CONDICIONES.join(', ')}.`);
    }

    const llave = `${centroOrigen} ${folio}`;
    if (vistos.has(llave)) mal(`el folio ${folio} de ${centroOrigen} ya está en el renglón ${vistos.get(llave)}.`);
    else vistos.set(llave, n);

    // D-107: no hay registro sin fotografía.
    const fotos = grupos.get(llave) ?? [];
    if (fotos.length === 0) {
      mal(`sin fotografía. Falta al menos «${centroOrigen}-${folio}-1.jpg» en la carpeta de fotografías.`);
    } else if (fotos.length > MAXIMO_POR_EJEMPLAR) {
      mal(`tiene ${fotos.length} fotografías y el máximo son ${MAXIMO_POR_EJEMPLAR}.`);
    }

    listos.push({ n, centroOrigen, folio, centroActual, nombre, edad, sexo, talla, condicion, fotos, llave });
  }

  /* Fotografías que no corresponden a ningún renglón: casi siempre un folio
     mal tecleado en el nombre del archivo. Se avisan, no detienen la carga. */
  const huerfanas = [...grupos.keys()].filter((k) => !vistos.has(k));

  if (problemas.length) {
    console.error(`\nNo generé nada. Hay ${problemas.length} problema(s) en la plantilla:\n`);
    for (const p of problemas) console.error('  · ' + p);
    if (sueltas.length) {
      console.error(`\nAdemás, estos archivos de la carpeta de fotografías no siguen el patrón CENTRO-FOLIO-N.jpg:`);
      for (const s of sueltas) console.error('  · ' + s);
    }
    console.error('\nCorrige la plantilla y vuelve a correr el guion.\n');
    process.exit(1);
  }

  /* ---- Generación ---- */

  console.log(`\n${listos.length} ejemplares, sin problemas. Generando…\n`);

  const sql = [];
  sql.push('-- ---------------------------------------------------------------------------');
  sql.push('-- Carga inicial del padrón');
  sql.push('--');
  sql.push(`-- Generada por carga-inicial/preparar.mjs el ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}`);
  sql.push(`-- ${listos.length} ejemplares, con identificadores del ${desdeId} al ${desdeId + listos.length - 1}.`);
  sql.push('--');
  sql.push('-- Los identificadores van escritos a mano y no los asigna la base, porque las');
  sql.push('-- rutas de las fotografías en el almacén se construyen con ellos y tienen que');
  sql.push('-- coincidir con los archivos que ya se subieron. Si alguno de esos números ya');
  sql.push('-- está ocupado, la migración falla al primer INSERT: eso es deseable, quiere');
  sql.push('-- decir que la base no estaba donde se creía.');
  sql.push('-- ---------------------------------------------------------------------------');
  sql.push('');

  const claves = [];
  let id = desdeId;

  for (const e of listos) {
    const slug = generarSlug(e.nombre, usados);
    const momento = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    sql.push(`-- ${e.centroOrigen} ${e.folio} · ${e.nombre}`);
    sql.push(`INSERT INTO ejemplar`);
    sql.push(`  (id, slug, centro_origen_clave, folio_interno, centro_actual_clave, nombre,`);
    sql.push(`   edad_clave, sexo_clave, talla_clave, semaforo, condicion, es_ficticio,`);
    sql.push(`   creado_en, actualizado_en, creado_por, actualizado_por)`);
    sql.push(`VALUES`);
    sql.push(`  (${id}, ${txt(slug)}, ${txt(e.centroOrigen)}, ${txt(e.folio)}, ${txt(e.centroActual)}, ${txt(e.nombre)},`);
    sql.push(`   ${txt(e.edad)}, ${txt(e.sexo)}, ${txt(e.talla)}, 'VERDE', ${txt(e.condicion)}, 0,`);
    sql.push(`   ${txt(momento)}, ${txt(momento)}, NULL, NULL);`);

    for (const { orden, archivo } of e.fotos) {
      const { salidas, ancho, alto, bytes } = await generarTamanos(join(FOTOS, archivo));
      const s = sello(e.centroOrigen, e.folio, orden);
      const r = {};

      for (const t of TAMANOS) {
        r[t.nombre] = ruta(id, orden, t.nombre, s);
        const destino = join(SALIDA, 'objetos', r[t.nombre]);
        await mkdir(dirname(destino), { recursive: true });
        await writeFile(destino, salidas[t.nombre]);
        claves.push(r[t.nombre]);
      }

      sql.push(`INSERT INTO fotografia`);
      sql.push(`  (ejemplar_id, orden, clave_original, clave_ficha, clave_tarjeta, clave_miniatura,`);
      sql.push(`   texto_alternativo, ancho, alto, bytes)`);
      sql.push(`VALUES`);
      sql.push(`  (${id}, ${orden}, ${txt(r.original)}, ${txt(r.ficha)}, ${txt(r.tarjeta)}, ${txt(r.miniatura)},`);
      sql.push(`   ${txt(`Fotografía de ${e.nombre}`)}, ${ancho}, ${alto}, ${bytes});`);
    }

    sql.push(`INSERT INTO bitacora (entidad, entidad_id, accion, campo, valor_anterior, valor_nuevo, usuario_id, ocurrido_en, ip)`);
    sql.push(`VALUES ('EJEMPLAR', ${id}, 'ALTA', NULL, NULL, ${txt(`${e.centroOrigen} ${e.folio} · ${e.nombre} · carga inicial del padrón`)}, NULL, ${txt(momento)}, NULL);`);
    sql.push('');

    console.log(`  ${String(id).padStart(4)}  ${e.centroOrigen} ${e.folio}  ${e.nombre}  (${e.fotos.length} fotografía${e.fotos.length === 1 ? '' : 's'})`);
    id++;
  }

  await writeFile(join(SALIDA, MIGRACION), sql.join('\n'), 'utf8');
  await writeFile(join(SALIDA, 'claves.txt'), claves.join('\n') + '\n', 'utf8');

  console.log(`\nListo.`);
  console.log(`  ${join(SALIDA, MIGRACION)}`);
  console.log(`  ${join(SALIDA, 'objetos')}   (${claves.length} archivos)`);
  console.log(`  ${join(SALIDA, 'claves.txt')}`);

  if (huerfanas.length) {
    console.log(`\nAviso: hay fotografías que no corresponden a ningún renglón de la plantilla.`);
    console.log(`No se cargarán. Revisa si el folio del nombre del archivo está bien escrito:`);
    for (const h of huerfanas) console.log('  · ' + h);
  }
  if (sueltas.length) {
    console.log(`\nAviso: estos archivos no siguen el patrón CENTRO-FOLIO-N.jpg y se ignoraron:`);
    for (const s of sueltas) console.log('  · ' + s);
  }
  console.log('');
}

main().catch((e) => { console.error('\n' + e.message + '\n'); process.exit(1); });
