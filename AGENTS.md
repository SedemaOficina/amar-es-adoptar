# Convenciones del proyecto

**Todo está en [`CLAUDE.md`](./CLAUDE.md).** Este archivo existe sólo porque distintas
herramientas buscan el suyo con distinto nombre.

## Por qué es un puntero y no una copia

Hasta el 18 de septiembre de 2026 los dos archivos tenían el mismo contenido, unidos por un
enlace duro en el disco: editar uno editaba el otro. Funcionaba en la máquina donde se
escribieron y falló en el primer commit posterior.

**Git no guarda enlaces duros.** Guarda dos archivos independientes, y además decide qué
releer comparando su propio registro con el estado del disco: como los dos caminos apuntan
al mismo archivo, dio uno por revisado y no volvió a leerlo. Resultado: en el disco eran
idénticos y en el repositorio no, sin ninguna señal visible.

Dos copias que hay que sincronizar a mano acaban distintas. Una copia y un puntero, no.
