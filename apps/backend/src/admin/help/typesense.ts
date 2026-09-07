import { defineHelp } from './types';

/**
 * Typesense es la extensión donde el modelo mental NO está en ningún campo: la
 * separación por tienda se hace por COLECCIÓN y no por credencial ni por scope,
 * así que el operador que busca "la API key de la tienda B" no la va a encontrar
 * nunca — y hoy el único lugar donde eso está escrito es el `reason` de un
 * `envOnly`, que la card no muestra.
 *
 * El gotcha caro es el mismo mecanismo visto al revés: una tienda apuntada a una
 * colección que no existe no da error, da CERO resultados de búsqueda.
 */
export default defineHelp({
  title: 'Typesense',
  summary: 'Indexa el catálogo en Typesense y sirve la búsqueda y las sugerencias del storefront.',
  sections: [
    {
      heading: 'La separación por tienda se hace por colección',
      body: `
        Typesense no se configura por tienda. Va con conexión plana para toda la
        instalación, y lo que separa a una tienda de otra es a qué COLECCIÓN le
        pega cada una.

        Por eso no hay una API key por tienda ni un host por tienda: buscar eso es
        buscar algo que no existe. Lo que hay son dos mapas, uno para productos y
        otro para búsquedas populares, que asocian el id de cada tienda con el
        nombre de su colección.

        Mientras los dos mapas estén vacíos —que es el estado por defecto— TODA
        tienda resuelve a la colección general y el comportamiento es el mismo que
        antes de que existieran.
      `,
    },
    {
      heading: 'Antes de llenar los mapas',
      body: `
        Sólo tiene sentido mapear una tienda si esa colección YA existe y se está
        indexando. Apuntar una tienda a una colección inexistente no devuelve un
        error: devuelve cero resultados de búsqueda, en silencio, y desde afuera se
        ve como un catálogo vacío.

        Los dos mapas son independientes y uno no se deduce del otro. Las búsquedas
        populares viven en su propia colección, así que separarlas por tienda pide
        su propio mapa aunque los productos ya estén separados.

        Al guardar se valida estricto: la clave tiene que ser el id de una tienda y
        el valor un nombre de colección con letras, números, guiones y guiones
        bajos. Es a propósito. Al LEER el sistema es indulgente y descarta lo que
        no entiende, para que un valor mal pegado nunca deje al buscador sin
        colección; si esa misma indulgencia valiera al escribir, un mapa con un
        número en vez de un nombre se guardaría sin quejarse y esa tienda seguiría
        pegándole a la colección general sin un solo mensaje.
      `,
    },
    {
      heading: 'Cambiar la colección de productos',
      body: `
        Cambiar el nombre de la colección apunta la búsqueda a otra colección, no
        renombra ni copia la que había.

        Si la nueva no existe o está vacía, hay que reindexar antes de que la
        tienda vuelva a devolver resultados.
      `,
    },
    {
      heading: 'Actualizar no es lo mismo que recrear',
      body: `
        Actualizar NO borra la colección: refresca todos los productos publicados y
        limpia los documentos huérfanos. Es la operación segura y la que se usa
        siempre.

        Recrear la borra y la rehace desde cero, así que la búsqueda del storefront
        queda degradada unos minutos. Los sinónimos y las curaciones se conservan.

        Recrear sólo hace falta cuando cambió el esquema del índice o cuando la
        colección quedó en un estado que refrescar no arregla.
      `,
    },
    {
      heading: 'Mantenimiento',
      body: `
        La reconciliación de stock corrige las diferencias entre Medusa y el
        índice: es la red que atrapa lo que los eventos de sincronización perdieron.
        Se puede apagar desde acá, pero su frecuencia se hornea al arrancar y se
        cambia por entorno.

        La retención del historial define cuántos días se guardan los registros de
        sincronización. La purga corre en su propio job programado, también con
        frecuencia de entorno.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        Las API keys no se cargan acá: van en el entorno del backend, junto con las
        del resto de los servicios de instalación.
      `,
      steps: [
        'Poner la API key de Typesense en el entorno del backend y reiniciar. La de analítica es opcional: sin ella se reusa la principal.',
        'Cargar host, puerto y protocolo del nodo. El host va sin protocolo ni puerto.',
        'Confirmar los nombres de las colecciones de productos y de búsquedas populares.',
        'Reindexar el catálogo y verificar que la búsqueda del storefront devuelva resultados.',
        'Sólo si hay varias tiendas con catálogos separados: crear e indexar sus colecciones, y recién ahí cargar los dos mapas.',
      ],
    },
  ],
});
