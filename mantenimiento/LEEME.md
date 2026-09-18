# Mantenimiento

Sentencias que no son migraciones: no cambian la estructura de la base, se
ejecutan a mano y sólo en momentos concretos. Por eso viven aquí y no en
`migraciones/`, donde todo se aplica en orden y una sola vez.

Se ejecutan igual que las migraciones:

    npx wrangler d1 execute amar-es-adoptar --local  --file=mantenimiento/<archivo>.sql
    npx wrangler d1 execute amar-es-adoptar --remote --file=mantenimiento/<archivo>.sql

## `marcar-todo-como-prueba.sql`

Mientras no haya un solo dato real, todo lo que exista en la base es prueba.
Un ejemplar capturado a mano desde la administración nace sin la marca, porque
el sistema no puede adivinar que era un ensayo. Esta sentencia se la pone.

Deja de usarse el día que entra el padrón real.

## `retirar-datos-de-prueba.sql`

Borra todo lo marcado como prueba. Se ejecuta una sola vez, cuando el padrón
real ya esté cargado y verificado, y con respaldo previo.

### Lo que esta sentencia no hace

Las fotografías que se subieron desde la administración están en el almacén
(R2), no en la base. Borrar el renglón de la tabla `fotografia` deja el archivo
en el almacén, sin nada que lo apunte: no se ve en ninguna pantalla, pero ocupa
lugar. Como en ese momento todavía no habrá subido ninguna fotografía real, lo
más limpio es vaciar el prefijo `ejemplar/` del almacén después de ejecutar el
retiro:

    npx wrangler r2 object delete amar-es-adoptar-fotos/ejemplar/<clave> --remote

Las fotografías de muestra de los datos ficticios no están en el almacén sino
en `public/imagenes/muestra/`, y se retiran borrando esa carpeta del proyecto.
