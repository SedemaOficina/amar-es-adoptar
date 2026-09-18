/* Carga inicial del padrón — subida de las fotografías al almacén.
 *
 * Segunda mitad del guion. `preparar.mjs` dejó los cuatro tamaños de cada
 * fotografía en `salida/objetos/`, con la ruta exacta que tendrán en el
 * almacén; este archivo los sube. Después se aplica la migración, y hasta
 * entonces la base no apunta a nada.
 *
 * EL ORDEN IMPORTA Y NO ES ARBITRARIO
 *
 * Primero los archivos, después los renglones. Si se hiciera al revés y la
 * subida fallara a la mitad, la base tendría fichas apuntando a imágenes que
 * no existen: el portal público las mostraría rotas. Al revés, lo peor que
 * queda es un archivo sin dueño, que no se ve y se limpia después. Es el
 * mismo criterio que sigue el alta desde el formulario.
 *
 * DE DÓNDE SALE EL NOMBRE DEL ALMACÉN
 *
 * De `wrangler.jsonc`, no escrito aquí. Es la misma regla que gobierna todo
 * el proyecto: si cambiar de entorno obliga a tocar código fuente, el diseño
 * está mal.
 *
 * SI SE INTERRUMPE
 *
 * Cada archivo subido se anota en `salida/subidas.txt`. Al volver a correr,
 * los que ya están se saltan. Así una subida larga que se corta por red o por
 * cerrar la ventana se retoma donde quedó, sin repetir ni saltarse nada.
 *
 * VELOCIDAD
 *
 * Sube de uno en uno. Cada archivo es un proceso de Wrangler y tarda un par
 * de segundos, así que el ensayo de dieciséis archivos corre en medio minuto
 * y el padrón real tardará bastante más. Se dejó así a propósito: hacerlo en
 * paralelo agrega complejidad para un problema cuyo tamaño todavía no
 * conocemos —no hay padrón—, y una subida lenta pero reanudable es mejor que
 * una rápida que no se sabe en qué estado quedó.
 *
 * CÓMO SE CORRE
 *
 *   node carga-inicial/subir.mjs carga-inicial/prueba            (almacén local)
 *   node carga-inicial/subir.mjs                        --remoto (almacén real)
 */
import { readFile, appendFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

/* CÓMO SE LLAMA A WRANGLER, Y POR QUÉ ASÍ
 *
 * Se invoca el archivo de Wrangler con el mismo Node que corre este guion,
 * sin pasar por `npx` ni por un intérprete de comandos.
 *
 * La primera versión usaba `npx wrangler …` con `shell: true`. En Windows eso
 * envuelve la llamada en `cmd.exe`, y Wrangler reventaba al cerrarse con una
 * falla de su biblioteca nativa —«Assertion failed: !(handle->flags &
 * UV_HANDLE_CLOSING)»— sin subir nada. El mismo comando escrito a mano en la
 * terminal funcionaba. Es decir: no era Wrangler, era la forma de lanzarlo.
 *
 * Llamarlo directo evita el intérprete de comandos, evita la advertencia de
 * seguridad de Node sobre argumentos sin escapar, y usa la versión de Wrangler
 * instalada en el proyecto y no la que `npx` decida bajar.
 */
const WRANGLER = join(RAIZ, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function correrWrangler(args) {
  return new Promise((listo, falla) => {
    const hijo = spawn(process.execPath, [WRANGLER, ...args], {
      cwd: RAIZ,                          // para que encuentre wrangler.jsonc y .wrangler/
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let error = '';
    hijo.stderr.on('data', (trozo) => { error += trozo; });
    hijo.on('error', falla);
    hijo.on('close', (codigo) => {
      if (codigo === 0) listo();
      else falla(new Error(error.trim() || `Wrangler terminó con código ${codigo}.`));
    });
  });
}

function leerArgumentos() {
  const args = process.argv.slice(2);
  let carpeta = null, remoto = false;

  for (const a of args) {
    if (a === '--remoto') remoto = true;
    else if (a.startsWith('--')) { console.error(`No conozco la opción «${a}».`); process.exit(1); }
    else if (carpeta === null) carpeta = a;
    else { console.error('Sobra un argumento: la carpeta de trabajo es una sola.'); process.exit(1); }
  }
  return { carpeta: resolve(carpeta ?? AQUI), remoto };
}

const { carpeta: CARPETA, remoto: REMOTO } = leerArgumentos();
const SALIDA  = join(CARPETA, 'salida');
const CLAVES  = join(SALIDA, 'claves.txt');
const SUBIDAS = join(SALIDA, 'subidas.txt');

/* El nombre del almacén sale de la configuración del proyecto. `wrangler.jsonc`
   admite comentarios, así que se limpian antes de interpretarlo: es JSON con
   comentarios, no JSON. */
async function nombreDelAlmacen() {
  const crudo = await readFile(join(AQUI, '..', 'wrangler.jsonc'), 'utf8');
  const limpio = crudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1');
  const config = JSON.parse(limpio);
  const bucket = config.r2_buckets?.[0]?.bucket_name;
  if (!bucket) throw new Error('No encontré «r2_buckets[0].bucket_name» en wrangler.jsonc.');
  return bucket;
}

async function yaSubidas() {
  try {
    return new Set((await readFile(SUBIDAS, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean));
  } catch { return new Set(); }
}

async function main() {
  try { await access(CLAVES); }
  catch {
    console.error(`\nNo encontré «${CLAVES}».\nCorre primero «node carga-inicial/preparar.mjs».\n`);
    process.exit(1);
  }

  const almacen = await nombreDelAlmacen();
  const claves = (await readFile(CLAVES, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean);
  const hechas = await yaSubidas();
  const faltan = claves.filter((c) => !hechas.has(c));

  console.log(`\nAlmacén: ${almacen}   (${REMOTO ? 'REMOTO — el de producción' : 'local'})`);
  console.log(`Archivos: ${claves.length}   ya subidos: ${hechas.size}   por subir: ${faltan.length}\n`);

  if (!faltan.length) { console.log('No hay nada pendiente.\n'); return; }

  let n = 0, fallos = 0;
  for (const clave of faltan) {
    n++;
    const archivo = join(SALIDA, 'objetos', clave);
    const etiqueta = `[${String(n).padStart(String(faltan.length).length)}/${faltan.length}]`;

    try {
      await correrWrangler([
        'r2', 'object', 'put', `${almacen}/${clave}`,
        `--file=${archivo}`,
        '--content-type=image/jpeg',
        '--cache-control=public, max-age=31536000, immutable',
        REMOTO ? '--remote' : '--local',
      ]);

      /* Se anota DESPUÉS de que Wrangler confirma. Anotarlo antes dejaría
         archivos dados por subidos que no lo están, y el reanudar los
         saltaría en silencio: justo el error que este registro evita. */
      await appendFile(SUBIDAS, clave + '\n', 'utf8');
      console.log(`${etiqueta} ✓ ${clave}`);
    } catch (e) {
      fallos++;
      console.error(`${etiqueta} ✗ ${clave}`);
      console.error('        ' + String(e.message).trim().split('\n').slice(-3).join('\n        '));
      if (fallos >= 3) {
        console.error(`\nTres fallos seguidos o más. Me detengo para no repetir el mismo error 2,000 veces.`);
        console.error(`Lo que sí subió quedó anotado: al volver a correr, retoma donde quedó.\n`);
        process.exit(1);
      }
    }
  }

  console.log(`\nListo. ${faltan.length - fallos} de ${faltan.length} subidos.`);

  /* El orden —primero los archivos, después los renglones— sólo protege si se
     respeta. Por eso el comando de la migración se ofrece ÚNICAMENTE cuando no
     quedó nada pendiente: aplicarla con archivos faltantes deja fichas
     apuntando a imágenes que no existen, y el portal las muestra rotas. */
  if (fallos) {
    console.log(`\n${fallos} fallaron.`);
    console.log(`NO apliques la migración todavía: quedarían fichas apuntando a`);
    console.log(`imágenes que no existen. Vuelve a correr este guion para`);
    console.log(`reintentar sólo los que faltan.\n`);
    process.exit(1);
  }

  console.log(`\nTodos los archivos están en el almacén. Ahora sí, la migración:`);
  console.log(`  npx wrangler d1 execute amar-es-adoptar ${REMOTO ? '--remote' : '--local'} --file=${join(SALIDA, '0012_carga_inicial.sql')}\n`);
}

main().catch((e) => { console.error('\n' + e.message + '\n'); process.exit(1); });
