import { defineHelp } from './types';

/**
 * WhatsApp es la extensión con más superficie de admin del lote —ajustes,
 * bandeja, plantillas, asesor, botón flotante— y su modelo mental está partido
 * en pedazos por esas pantallas: el gotcha del nombre de plantilla vacío está en
 * la `description` de una card Y en seis `help:` de campo, y el de "un pedido
 * pertenece a un solo canal" vive en el pie de un card que sólo se ve si entrás
 * a esa sección.
 *
 * Lo que se rescató como sección propia es lo que falla EN SILENCIO: sin ID de
 * número no se manda nada y queda todo logueado sin error, y un idioma que no
 * coincide exactamente con el de la plantilla aprobada es otra plantilla para
 * Meta.
 */
export default defineHelp({
  title: 'WhatsApp (Kapso)',
  summary:
    'Manda notificaciones por WhatsApp y atiende conversaciones a través de Kapso, con plantillas de Meta.',
  sections: [
    {
      heading: 'Quién es quién',
      body: `
        El número, las plantillas y su aprobación son de META. Kapso es el
        intermediario que expone ese número como API y hospeda la bandeja. Esta
        pantalla sólo guarda con qué cuenta de Kapso y con qué número se opera, y
        cómo se llaman las plantillas que Meta ya aprobó.

        Nada de lo que se guarda acá crea ni aprueba una plantilla por sí solo: si
        Meta no la aprobó, el envío se rechaza aunque el nombre esté bien escrito.

        Las credenciales se guardan cifradas y tienen efecto en el mensaje
        siguiente, sin reiniciar el backend.
      `,
    },
    {
      heading: 'Sin ID de número no se envía nada, y no hay error',
      body: `
        El identificador del número de teléfono de Meta es el que emite los
        mensajes. Sin él no sale ninguna notificación: todo queda logueado y la
        operación se da por terminada sin error visible.

        Es la falla más difícil de detectar de esta extensión, porque desde el
        admin todo parece haber funcionado.

        El identificador de la cuenta de WhatsApp Business hace falta SÓLO para
        crear y editar plantillas desde el admin. El envío de mensajes no lo usa,
        así que se puede operar sin él.
      `,
    },
    {
      heading: 'El nombre de plantilla vacío es el interruptor de apagado',
      body: `
        En el grupo de carritos y pedidos, dejar el nombre de una plantilla vacío
        NO es un campo sin completar: es la forma de apagar el WhatsApp de ese
        aviso. El email correspondiente se sigue mandando igual.

        Es deliberado y aplica a los tres pasos de carrito abandonado y a los tres
        avisos de suscripciones. Si tuvieran un valor por defecto, la tienda
        empezaría a mandar plantillas que Meta nunca aprobó y todos esos mensajes
        se rechazarían.

        Las plantillas de recuperación de carrito son de categoría promocional para
        Meta: son más caras que las transaccionales, requieren consentimiento y
        tienen límites de envío por usuario. Las de pedido y envío son
        transaccionales.
      `,
    },
    {
      heading: 'El idioma tiene que coincidir exactamente',
      body: `
        El código de idioma tiene que ser el mismo que el de la plantilla aprobada,
        carácter por carácter. Para Meta, "es" y "es_AR" son DOS plantillas
        distintas.

        Un idioma que no coincide es la segunda causa de mensajes que no llegan,
        después del nombre mal escrito, y desde el admin las dos se ven igual.
      `,
    },
    {
      heading: 'El catálogo que atiende el bot',
      body: `
        El bot ofrece productos de los canales de venta que se le habiliten. Con
        varios canales busca en todos, pero un pedido pertenece a UNO solo: se usa
        el primero que tenga todos los productos del carrito.

        La consecuencia es que un carrito armado con productos de dos canales
        distintos no se puede cerrar. Si el bot arma el carrito y después no puede
        confirmar el pedido, esto es lo primero que hay que mirar.

        La región define moneda y precios de lo que arma el bot. Si no hay una
        fijada se deduce del país, y si esa deducción falla el bot no puede
        cotizar.

        Meta rechaza el carrusel COMPLETO si no puede decodificar una sola imagen.
        Por eso hay una imagen de reemplazo: con ella, los productos sin foto usable
        entran igual; sin ella, el bot cae a la lista de texto.
      `,
    },
    {
      heading: 'Cuando una persona toma la conversación',
      body: `
        El bot no responde mientras una persona está atendiendo. Ese estado se
        llama handoff y no hace falta cerrarlo a mano.

        Si nadie lo cierra, la conversación vuelve al bot sola pasadas las horas
        configuradas. Es una red de seguridad, no el camino normal: sirve para que
        una conversación olvidada no quede muda para siempre.
      `,
    },
    {
      heading: 'La bandeja embebida',
      body: `
        La bandeja se muestra dentro de un iframe del admin. La URL que se carga es
        un token de un solo propósito: la API key nunca viaja al navegador.

        El paso que más se olvida es el de los orígenes permitidos. Sin el dominio
        del admin en esa lista el iframe no carga, y el síntoma es una bandeja en
        blanco sin ningún mensaje de error.
      `,
      steps: [
        'En el dashboard de Kapso, entrar a Project y después a Inbox Embeds, y crear un embed con alcance de proyecto.',
        'En Allowed origins, agregar el dominio de este admin, con comodín si corresponde.',
        'Copiar la URL del embed y pegarla en el campo de URL del inbox embebido.',
        'Recargar esta pantalla.',
      ],
    },
    {
      heading: 'Webhooks',
      body: `
        El secreto de firma valida el HMAC de cada evento entrante. Vacío, la firma
        NO se verifica y se acepta cualquier cosa que llegue a esa ruta: dejalo
        puesto en producción.

        El token de verificación es otra cosa: es el desafío de alta estilo Meta.
        Sin él, Kapso no puede dar de alta la suscripción, así que el síntoma es que
        nunca llega ningún evento.
      `,
    },
    {
      heading: 'Medición por tienda y del asesor',
      body: `
        El número se resuelve por tienda a partir de las credenciales de tienda, y
        la tienda viaja en los datos de cada notificación. Las plantillas acompañan
        a la cuenta, no a la tienda.

        El embudo del asesor se cuenta por SESIÓN, no por mensaje: lo que interesa
        es cuántas conversaciones llegaron a cada paso.

        Cambiar el vocabulario del filtrado guiado obliga a re-sincronizar
        Typesense: los atributos por los que el asesor pregunta se derivan al
        indexar, así que hasta la próxima indexación el cambio no se ve.
      `,
    },
  ],
});
