// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // El adaptador de Cloudflare permite que convivan dos tipos de página:
  //   · Las públicas se generan al construir y salen como HTML estático.
  //     Son las que ve la ciudadanía y deben ser rápidas.
  //   · Las de administración se generan en el servidor, porque dependen
  //     de quién inició sesión y de lo que haya en la base en ese momento.
  //     Se marcan con `export const prerender = false` en la propia página.
  adapter: cloudflare({
    // Da acceso a la base de datos durante `npm run dev`, usando la copia
    // local que crea wrangler. Sin esto habría que desplegar para probar
    // cualquier consulta.
    platformProxy: { enabled: true },

    // El sitio no procesa imágenes con Astro: las fotografías se sirven tal
    // como las genera el módulo de carga, en los tres tamaños que guardamos.
    // Con 'passthrough' evitamos que el adaptador declare el servicio de
    // imágenes de Cloudflare, que no usaríamos y que ataría el proyecto a
    // una función propietaria más.
    imageService: 'passthrough',
  }),
});
