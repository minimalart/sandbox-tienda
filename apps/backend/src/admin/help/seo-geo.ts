import { defineHelp } from './types';

/**
 * SEO & GEO es la pantalla con DOS alcances distintos en la misma vista, y el
 * comentario de `routes/seo-geo/configuracion/page.tsx` explica por qué la card
 * de abajo no sigue al selector de arriba. Ese texto es exactamente lo que el
 * operador necesita y hoy es un comentario de JSX: la UI sólo dice "lo guardado
 * acá pisa las variables de entorno", que es cierto y no responde la pregunta.
 *
 * El gotcha caro es el incidente del 2026-07-23 (500 páginas por concurrencia 8
 * clavaron el único vCPU y el proveedor mató el contenedor en loop todo el día).
 * Hoy vive en el `reason` de un `envOnly` y en un comentario del módulo — o sea,
 * en ninguno de los dos lugares donde alguien va a subir el máximo de páginas.
 * Y su consecuencia visible es la que más desconcierta: el tope se puede subir a
 * 500 en el formulario, se guarda sin quejarse, y el crawl igual se corta.
 */
export default defineHelp({
  title: 'SEO & GEO',
  summary: 'Audita el storefront, puntúa su visibilidad en buscadores y en IA, y propone correcciones sobre el catálogo.',
  sections: [
    {
      heading: 'Qué hace una auditoría',
      body: `
        Una auditoría crawlea el storefront y corre sobre lo que encuentra los
        motores que estén prendidos: técnico, arquitectura, catálogo y GEO. Cada
        motor deja hallazgos, y de los hallazgos salen las correcciones asistidas
        sobre el catálogo.

        GEO es la mitad que no es SEO clásico: puntúa qué tan bien puede una IA
        entender y recomendar los productos, con dimensiones de comprensión,
        cobertura, autoridad, comparabilidad, datos estructurados y profundidad.

        El Simulador es la comprobación de eso mismo: hace una pregunta contra los
        embeddings del catálogo y muestra qué productos se recuperaron y cuáles
        no. Un producto que nunca aparece es un producto que la IA no va a
        recomendar.
      `,
    },
    {
      heading: 'Open Graph: lo que se ve al compartir un link',
      body: `
        La sección Open Graph de Configuración define la card que muestran WhatsApp,
        Instagram, X y Slack cuando alguien pega un link de la tienda. Es por tienda,
        como el resto de esa card.

        Un campo vacío NO está sin configurar: significa "usá el default del sitio".
        Escribir el nombre de la tienda a mano lo congela —si mañana cambia, la card
        sigue diciendo el viejo—; dejarlo en blanco lo hace seguir al nombre real. Lo
        mismo con la imagen: sin imagen propia se usa la tarjeta 1200×630 que el
        storefront genera con el nombre y el color de la tienda, que ya es un default
        digno.

        La imagen se elige de la Biblioteca y conviene que sea 1200×630: las redes
        recortan centrado lo que no entra. Los cambios tardan hasta cinco minutos en
        verse, y cada red cachea la card por su cuenta — WhatsApp y Facebook pueden
        seguir mostrando la anterior por horas aunque el sitio ya emita la nueva.
      `,
    },
    {
      heading: 'Del score a la acción',
      body: `
        AI Visibility termina en “Qué cerrar primero”: los hallazgos de Catálogo y GEO
        de la última auditoría, ordenados por CUÁNTOS PRODUCTOS mueve cerrar cada uno y
        no por severidad, porque eso es lo que corre el score.

        Los que la IA puede redactar —casos de uso, beneficios, materiales, atributos
        comparables, FAQ— llevan botón directo a Correcciones con ese gap ya marcado. Los
        que no aparecen con botón es porque no se arreglan escribiendo: un producto sin
        SKU, sin imágenes o sin categoría necesita el dato cargado, y ofrecer la IA ahí
        sería prometer que lo inventa.

        Las preguntas de Keywords salen de las categorías de ESTA tienda. Antes salían de
        todas: una tienda veía preguntas sobre categorías que no vende, marcadas como sin
        cubrir, o sea una lista de tareas que no le correspondían.
      `,
    },
    {
      heading: 'Un score en “—” quiere decir que no se pudo medir',
      body: `
        El SEO score arranca en 100 y RESTA penalidades por hallazgo. Eso hace que
        una auditoría que no analizó nada dé exactamente lo mismo que un sitio
        impecable: 100.

        Por eso, cuando la auditoría no es medible el score se guarda vacío y el
        dashboard muestra “—” con el motivo al lado, en vez de un 100. Pasa en tres
        casos: los motores Técnico y Arquitectura están apagados en Configuración;
        el crawler quedó afuera de la página de contraseña; o el crawl terminó en una
        sola página porque no encontró enlaces internos ni URLs de sitemap del mismo
        origen.

        Lo del gate merece una aclaración: que una tienda tenga contraseña NO impide
        auditarla. La auditoría firma la misma llave que usa el storefront y crawlea
        adentro, que es lo que hace falta para revisar el SEO ANTES de abrir al
        público. El hallazgo “Tienda detrás de la contraseña” aparece sólo cuando esa
        llave no abre —la palabra cambió, o el gate lo puso otro módulo—, y entonces
        sí el score queda vacío.

        Los tres quedan además como hallazgos críticos del motor “crawl”, junto con
        un cuarto que no invalida el score pero es igual de caro: canonicals
        apuntando a localhost, que es la URL pública del storefront mal configurada
        y se lleva puestos también el sitemap y el robots.txt.
      `,
    },
    {
      heading: 'La pantalla tiene dos alcances y no son el mismo',

      body: `
        La card de arriba —motores, umbrales, crawler, simulador,
        automatización— es POR TIENDA y sigue al selector: cada tienda audita con
        su propia configuración.

        La card de ajustes de abajo es de la INSTALACIÓN. Sus valores los consume
        el crawler, que corre dentro de jobs sin ninguna tienda de la cual
        derivarse, así que un valor por tienda no tendría dónde aplicarse.

        Eso significa que el selector de arriba NO gobierna la card de abajo. Es
        la única pantalla del admin donde esa repetición es deliberada: sin
        decirlo, quedaría un formulario debajo de una franja que dice
        "Configurando Norte" y se leería como si fuera de Norte.
      `,
    },
    {
      heading: 'Cada tienda se crawlea sola, y el catálogo tiene cuota',
      body: `
        Una tienda secundaria vive en \`/tienda/<slug>\` del mismo dominio que la
        principal. El crawl se acota a ese prefijo: la auditoría de una tienda no
        recorre —ni puntúa— las páginas de otra, y la de la principal excluye
        \`/tienda/*\` porque cada tienda tiene la suya.

        Las semillas salen del sitemap, que en un catálogo real es casi todo fichas
        de producto. Por eso hay una cuota de fichas dentro del máximo de páginas:
        sin ella el presupuesto entero se gasta en fichas del mismo template y el
        crawl nunca llega a la home, a las categorías ni al blog, que es donde los
        hallazgos se diferencian. El catálogo no se pierde por eso: los motores de
        Catálogo y GEO puntúan los productos leyéndolos de la base, sin crawlear
        una sola ficha.
      `,
    },
    {
      heading: 'El crawler corre adentro del web service',
      body: `
        No hay un worker aparte: el crawl compite por CPU con el HTTP server que
        atiende el storefront. La pausa entre lotes es lo que le cede el event
        loop entre lote y lote.

        El 2026-07-23 una auditoría de 500 páginas con concurrencia 8 clavó el
        único vCPU del servicio y el proveedor mató el contenedor en loop durante
        todo el día. Bajar la pausa acelera la auditoría a costa de latencia en el
        storefront y en los health checks; ponerla en cero significa no ceder
        nunca.
      `,
    },
    {
      heading: 'Subir el máximo de páginas a 500 no hace nada',
      body: `
        El máximo de páginas y la concurrencia del formulario de arriba están
        acotados por dos topes duros que viven en el entorno, no en la base. Lo
        que se guarda se recorta contra ellos al leerlo.

        Es a propósito, y por el incidente de arriba: si el tope viviera en la
        misma tabla que vigila, cualquiera con acceso al admin podría reproducir
        el incidente subiéndolo. Es una decisión de tamaño de infraestructura y va
        donde se decide ese tamaño, en el deploy.

        La consecuencia práctica: si tus auditorías se cortan siempre en el mismo
        número de páginas y el formulario dice otro, el que manda es el tope del
        entorno.
      `,
    },
    {
      heading: 'Auditorías que quedan trabadas',
      body: `
        Una auditoría en curso registra avance en cada lote. Si el proceso muere a
        mitad —un deploy, un reinicio, un out of memory— la fila queda en "en
        curso" para siempre y BLOQUEA el módulo entero: no se puede lanzar otra.

        El umbral de minutos sin progreso es lo que la destraba: pasado ese
        tiempo, se marca como fallida y se libera el módulo. Muy bajo mata
        auditorías vivas que están procesando un lote lento; muy alto deja el
        módulo trabado más tiempo del necesario.
      `,
    },
    {
      heading: 'Cuál es el modelo de chat que se usa de verdad',
      body: `
        El modelo que usan el Simulador y las correcciones asistidas es el de la
        card de ajustes de abajo, no el campo "modelo del simulador" de la
        configuración de arriba.

        Ese campo se guarda pero hoy no lo lee nadie. Es deriva anterior a esta
        migración y está anotada acá para que nadie pierda una tarde cambiándolo y
        esperando que algo pase.
      `,
    },
    {
      heading: 'Las credenciales de IA se comparten con otras extensiones',
      body: `
        La API key de OpenRouter y la configuración de embeddings las usan también
        el Catalogador y el Asistente IA, y por eso viven en el entorno y no acá.
        Una fila en la base sólo la vería el cliente de SEO & GEO: los otros dos
        seguirían leyendo el entorno, y dos clientes que hoy SIEMPRE coinciden
        pasarían a poder divergir en silencio.

        La dimensión de los embeddings es la más peligrosa de todas. Cambiarla
        invalida TODOS los embeddings ya guardados: los vectores viejos y los
        nuevos dejan de ser comparables y el Simulador devuelve resultados al azar
        hasta que se reindexa el catálogo entero. No es una perilla de formulario,
        es una migración de datos.
      `,
    },
    {
      heading: 'Las auditorías programadas y sus tres cron',
      body: `
        La frecuencia de negocio —desactivada, semanal o mensual— se elige en la
        configuración de arriba. Eso es lo que hay que tocar para prender o apagar
        las auditorías automáticas.

        Los tres schedules que las ejecutan (el job de auditoría, el que pregunta
        si toca encolar y el que embebe el catálogo) los hornea Medusa al arrancar
        y no se pueden reprogramar desde el admin. Sólo dicen cada cuánto se
        pregunta, no cada cuánto se audita.

        El tamaño del lote de embeddings sí se configura acá: es cuántos productos
        embebe cada pasada. El job es incremental y saltea los que no cambiaron,
        así que subirlo acelera la primera carga del Simulador y sube el costo por
        corrida.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        Los dos primeros pasos deciden si el crawl puede correr sin voltear el
        servicio. Los últimos son los que habilitan la mitad de IA.
      `,
      steps: [
        'Verificar con quien administra el deploy cuáles son los topes de páginas y de concurrencia del entorno: son el techo real del formulario.',
        'Configurar el crawler dentro de esos topes y dejar la pausa entre lotes por encima de cero.',
        'Elegir qué motores corren. Comercial y performance todavía no producen hallazgos.',
        'Lanzar una auditoría a mano desde el Dashboard y verificar que termine sin degradar el storefront.',
        'Revisar los hallazgos y aplicar las primeras correcciones sobre el catálogo.',
        'Para la mitad de IA: verificar que la credencial de OpenRouter y la de embeddings estén cargadas en el entorno del backend.',
        'Esperar a que el job de embeddings recorra el catálogo y probar el Simulador con una pregunta real de un cliente.',
        'Recién ahí prender las auditorías programadas con la frecuencia que corresponda.',
      ],
    },
  ],
});
