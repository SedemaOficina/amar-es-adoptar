# Amar es Adoptar

Plataforma de adopción de seres sintientes de la **Secretaría del Medio Ambiente de la
Ciudad de México**.

Sustituye a la plataforma vigente en `amaresadoptar.cdmx.gob.mx`, corrigiendo por diseño
sus fallas conocidas: dos fuentes de datos que no se sincronizaban, la ficha pública rota
por un identificador ambiguo, un solo perfil de usuario con permiso de borrado, y el
recorte inconsistente de fotografías.

## Estado

| Etapa | Alcance | Estado |
|---|---|---|
| 1 | Portal público con datos ficticios | En curso |
| 2 | Administración, base de datos y carga masiva | Pendiente |
| 3 | Conexión del portal a datos reales | Pendiente |
| 4 | Solicitudes de adopción con Llave CDMX | Pendiente |
| 5 | Indicadores | Pendiente |
| 6 | Cierre de entrega a ADIP | Pendiente |

## Cómo está armado

```
public/imagenes/      Logotipo institucional e imágenes de muestra
src/datos/            Datos de los ejemplares y su módulo de acceso
src/layouts/          Plantilla común: encabezado, navegación y pie
src/components/       Tarjeta del catálogo
src/pages/            Páginas del sitio
src/estilos/          Hoja de estilos global y paleta institucional
migraciones/          Esquema de la base de datos (etapa 2)
```

**El archivo que importa entender es `src/datos/ejemplares.js`.** Es la única pieza que
cambia en la etapa 3: hoy lee un archivo JSON con datos ficticios; cuando exista la API se
sustituye el contenido de sus funciones y ninguna página tiene que tocarse. Ese punto
único de acceso es lo que impide que el portal público y la administración terminen
leyendo fuentes distintas.

## Datos ficticios

Mientras `src/datos/ejemplares.json` tenga `es_ficticio: true`, el sitio muestra un aviso
permanente en la parte superior. Los 30 registros son inventados y las fotografías son
rectángulos generados, marcados con la leyenda «FOTO DE MUESTRA». Se retiran en la
etapa 2, al cargar la información verdadera.

## Despliegue

Ver [`DESPLIEGUE.md`](./DESPLIEGUE.md).

## Titularidad

Ver [`TITULARIDAD.md`](./TITULARIDAD.md).
