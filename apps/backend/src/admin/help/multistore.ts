import { defineHelp } from './types';

/**
 * Multitienda es la extensión donde el drawer más rinde, y por una razón que no
 * se ve mirando el descriptor: `descriptors/multistore.ts` declara DOS ajustes
 * —el ritmo del importador— y el resto del modelo no está en ningún campo. Está
 * repartido entre `admin/lib/active-site.ts` (por qué cambiar de tienda recarga),
 * `lib/multistore/types.ts` (qué significa "sin tienda elegida"),
 * `lib/multistore/credentials.ts` (las credenciales por tienda), la lista de
 * slugs reservados y el runbook `docs/recipes/tiendas-por-subdominio.md`.
 *
 * Todos comentarios de código, o sea: cero de eso lo lee el operador que tiene
 * tres tiendas y no entiende por qué el listado de banners le muestra los de las
 * tres.
 *
 * Los gotchas caros son dos y los dos son irreversibles: renombrar el slug de una
 * tienda publicada hace que el host viejo sirva 200 con el contenido del sitio
 * PRINCIPAL —peor que un 404—, y rotar la clave de firma de sesiones volvía
 * indescifrables todas las credenciales de tienda sin un solo error al arrancar.
 */
export default defineHelp({
  title: 'Multitienda',
  summary: 'Varias tiendas sobre una misma instancia de Medusa, cada una con su canal de venta, región, depósito y catálogo.',
  sections: [
    {
      heading: 'Importar catálogo al crear o editar una tienda',
      body: `
        El alta incluye el paso Origen. Para una tienda existente, incluida la
        principal, abrí Editar → Catálogo. Ambos usan los mismos campos de origen.
        Configurá la fuente, revisá una muestra y confirmá la importación.
        El avance y el resultado quedan en esa misma pestaña. La tienda editada
        determina el destino; el selector global no lo cambia.
        Esta capacidad está incluida en Tiendas y no requiere otra extensión.
      `,
    },
    {
      heading: 'Qué es una tienda acá adentro',
      body: `
        Una tienda no es una instalación aparte: es una fila que agrupa recursos
        de esta misma instancia de Medusa. Al crearla se le provisiona su propio
        canal de venta, su región, su depósito, su set de envíos y, si se pide,
        un canal mayorista con su lista de precios y su grupo de clientes.

        El eje declarado es el id de la tienda, que es inmutable. El slug es
        mutable en la base pero NO se puede cambiar después de crear la tienda, y
        el backend lo rechaza: es la URL pública.

        Una tienda con B2B tiene DOS canales de venta, no uno. Eso importa cada
        vez que algo se filtra "por el canal de la tienda": el filtrado correcto
        usa los dos.
      `,
    },
    {
      heading: 'La tienda activa viaja por header, y eso explica casi todo',
      body: `
        El selector de arriba no cambia la URL: guarda la tienda elegida y todas
        las llamadas del admin la mandan en un header. Por eso el detalle de una
        orden no "se pone de acuerdo" con la orden que muestra — muestra lo que el
        operador eligió, que es justamente lo que deja ver el caso raro: una orden
        que pertenece a otra tienda.

        Como viaja por header y no por la URL, el cache del admin no lo ve. De ahí
        sale que cambiar de tienda RECARGUE la página. No es lentitud ni falta de
        pulido: la mitad de las pantallas usan claves de cache sin la tienda
        adentro, así que sin recargar servirían datos de la tienda anterior. Y hay
        algo peor que datos viejos: un formulario precargado con la tienda A y
        guardado estando en la B escribe en la tienda equivocada.

        Hay pantallas que cambian de tienda EN CALIENTE, sin recargar, y son las
        que cumplen las tres condiciones para hacerlo. Se reconocen porque avisan
        cuando hay un borrador sin guardar antes de cambiar.
      `,
    },
    {
      heading: 'Sin tienda elegida significa TODAS, no la principal',
      body: `
        En el admin, no elegir tienda no cae a la tienda principal: no filtra
        nada. Es deliberado. Un operador de tres tiendas que viera sólo la
        principal sin haberlo pedido estaría viendo un tercio de su data sin
        ninguna señal de que falta el resto.

        El badge de la franja de arriba dice en qué estado está cada pantalla.
        Verde significa que lo que se ve y lo que se edite pertenece a la tienda
        elegida. Gris significa que esa pantalla es de la INSTANCIA y el selector
        no la gobierna. Naranja significa que esa pantalla todavía no filtra.

        Una pantalla con badge gris debajo de un selector que dice "Norte" NO
        edita lo de Norte, aunque esté en la misma página. Es el caso de
        Preferencias en su pestaña Comercio, y de las cards de ajustes de
        extensiones cuyo alcance es de instancia.
      `,
    },
    {
      heading: 'Elegir una tienda que ya no existe rompe, no degrada',
      body: `
        Si el admin quedó con una tienda guardada que fue borrada, la próxima
        llamada falla con un error explícito en vez de mostrar todo.

        Degradar ahí sería el peor comportamiento posible: un id viejo terminaría
        mostrando datos de TODAS las tiendas mientras el operador cree que está
        mirando una sola. El error es lo que le permite al admin limpiar la
        elección y pedir otra.

        Con UNA sola tienda, en cambio, no se filtra nada aunque esté elegida: no
        hay nada que aislar, y filtrar igual escondería filas cuyo canal se creó a
        mano y no pertenece a ninguna tienda.
      `,
    },
    {
      heading: 'El slug no se toca nunca',
      body: `
        El slug es la URL pública de la tienda. Con la forma por ruta se publica
        en /tienda/slug; con la forma por subdominio, en slug punto el sufijo
        configurado. Las dos funcionan siempre: la URL canónica sólo elige cuál
        indexa Google, y la otra queda noindex.

        Renombrarlo después de publicar rompe los links ya compartidos, y bajo
        subdominios es peor que eso: el host viejo pasa a ser desconocido y sirve
        200 con el contenido del sitio PRINCIPAL. Un cliente que entra por el link
        viejo ve otra tienda, no un error. Por eso el backend lo rechaza.

        La lista de slugs reservados es a propósito más amplia de lo necesario.
        Prohibir de más hoy cuesta un puñado de palabras que nadie quiere;
        prohibir de menos cuesta una migración de URLs ya indexadas, porque
        ampliar la lista después vuelve ilegal un slug vivo.
      `,
    },
    {
      heading: 'Credenciales por tienda',
      body: `
        Cada tienda puede tener sus propias credenciales de terceros —su cuenta de
        Andreani, su acuerdo de Correo— cargadas desde el backoffice y cifradas en
        reposo. Mientras una tienda no tenga las suyas, se usan las del entorno.
        Eso es lo que permite migrar de a una sin romper nada.

        Cuando una tienda tiene credencial propia, esa GANA sobre lo que esté
        cargado en la card de ajustes de la extensión. Si cambiaste un valor allá
        y no pasó nada, mirá si esa tienda tiene su propia credencial.

        Los valores se guardan cifrados y no se muestran NUNCA: de una credencial
        ya cargada sólo se ve el nombre. Eso es lo que explica los botones de cada
        renglón —Reemplazar, Borrar, Deshacer— en vez de un campo editable: no hay
        forma de mostrar el valor viejo para corregirle un caracter, así que se
        pisa entero o no se toca.

        El secreto raíz sigue siendo del entorno. Ojo con rotarlo: antes la clave
        se derivaba de la que firma las sesiones, así que rotarla para invalidar
        sesiones volvía indescifrables TODAS las credenciales de tienda sin un
        solo error al arrancar. Hoy son dos claves distintas justamente para
        despegar los dos calendarios de rotación.
      `,
    },
    {
      heading: 'El ritmo del importador es de la instalación',
      body: `
        Los dos ajustes de la pantalla de configuración gobiernan al cliente HTTP
        que le pide el catálogo a la tienda de ORIGEN, y son de instancia, no por
        tienda. El portón que espacia las requests es uno solo por proceso: un
        valor por tienda no tendría dónde aplicarse.

        La espera mínima se lee EN CADA request, no una vez al arrancar. Ese es
        todo el punto: cuando una fuente empieza a devolver 429 en el medio de una
        importación, se sube el número y la request siguiente ya sale más
        espaciada, sin matar la importación que se estaba tratando de salvar.

        La base del backoff sólo se usa cuando la fuente NO manda su propia
        cabecera de reintento. Si la manda, esa gana siempre.
      `,
    },
    {
      heading: 'Los estados de una tienda',
      body: `
        Una tienda recién creada pasa por Configurando (se le crean canal, región
        y depósito) e Importando (se trae el catálogo) antes de quedar Lista. La
        configuración pública del storefront responde 404 mientras no esté Lista.

        Una RE-importación fallida no degrada a Falló una tienda que ya tiene
        catálogo usable: sería romper una tienda que vende por un problema
        pasajero de la fuente.

        Las importaciones las ejecuta un job programado, no el botón: crear o
        reintentar sólo encola. Los detalles de ese motor están en la ayuda del
        Importador de catálogo.
      `,
    },
    {
      heading: 'Puesta en marcha de una tienda',
      body: `
        Los dos primeros pasos son irreversibles. El resto se puede corregir
        después.
      `,
      steps: [
        'Elegir el slug con cuidado: no se puede cambiar después y es la URL pública.',
        'Elegir la URL canónica (subdominio o ruta). Las dos van a funcionar; esto sólo decide cuál indexa Google.',
        'Completar país, moneda e idioma. Un país pertenece a una sola región en Medusa, así que esto define contra qué región opera la tienda.',
        'Cargar el branding: colores, tipografía y fondos del header y del footer.',
        'Elegir el origen del catálogo: una plataforma externa (WooCommerce, VTEX o Shopify) o un canal de venta que ya vive en esta instancia.',
        'Opcional: habilitar B2B mayorista, que provisiona un segundo canal, un grupo de clientes y una lista de precios con escalas.',
        'Crear y esperar a que la tienda pase a Lista. La importación la ejecuta un cron, no el botón.',
        'Cargar las credenciales propias de esa tienda en Credenciales por tienda, si va a operar con cuentas distintas de las del entorno.',
      ],
    },
    {
      heading: 'B2B al editar una tienda',
      body: "El portal de la principal abre en `/b2b`, aunque se haya visitado una tienda hija antes. Las hijas conservan su propio portal en `/tienda/{slug}/b2b` o en su dominio.\n\nEl editor se organiza en pestañas: General, Branding, Contenido, Operación, B2B y Funciones. En B2B se puede desactivar el portal sin borrar sus recursos: todas sus rutas vuelven al inicio de esa tienda. El login, registro y panel muestran el logo configurado de la tienda activa, incluida la principal.\n\nEn Editar se puede elegir un canal mayorista y una lista de precios existentes, o dejar la creación automática. El canal mayorista debe ser distinto del minorista y no pertenecer a otra tienda. Guardar completa los recursos faltantes incluso si B2B ya estaba activado; si falla, muestra el error y permite reintentar. Hace falta una región y un depósito asignado o un único depósito vinculado al canal minorista.\n\nLa creación automática agrega la lista aun con el catálogo vacío. Una lista elegida manualmente conserva sus precios y condiciones, incluye al grupo mayorista sin restringir listas públicas y no recibe las escalas automáticas. Las importaciones posteriores y la eliminación de la tienda conservan los recursos seleccionados manualmente.",
    },
  ],
});
