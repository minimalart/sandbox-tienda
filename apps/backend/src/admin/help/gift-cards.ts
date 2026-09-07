import { defineHelp } from './types';

/**
 * Gift Card Experience tiene DOS interruptores que se combinan con AND y viven
 * en pantallas distintas de la misma página, con la explicación de por qué no
 * son redundantes escondida en el comentario de cabecera de
 * `descriptors/gift-cards.ts`. Es el caso exacto de este módulo: algo que es de
 * la EXTENSIÓN y que hoy se explica en un comentario del código.
 *
 * El gotcha que más vale es el que protege plata y no se ve en ninguna pantalla:
 * la emisión está detrás de "la orden está PAGADA", y un pago autorizado y no
 * capturado —que es el estado de una orden cuando se emite `order.placed`— NO
 * cuenta. Está probado en `gift-card-experience/issuance-guard.test.ts`.
 */
export default defineHelp({
  title: 'Gift Card Experience',
  summary:
    'Vende gift cards con diseño y mensaje, y las entrega al destinatario en la fecha y la franja elegidas.',
  sections: [
    {
      heading: 'Dos interruptores, y hacen falta los dos',
      body: `
        La extensión operativa es el interruptor de NEGOCIO: lo maneja quien opera
        la tienda y controla emisión, jobs y experiencia.

        La extensión habilitada en este entorno es el interruptor de DESPLIEGUE:
        deja apagada la extensión entera en un entorno donde todavía no se quiere
        que emita nada.

        Se combinan con Y lógico. Con cualquiera de los dos apagado no se emite ni
        se entrega nada y el job de reconciliación no corre. No es redundancia: son
        dos decisiones de dos personas distintas.
      `,
    },
    {
      heading: 'Sólo se emite contra una orden cobrada',
      body: `
        La intención de entrega se crea siempre, apenas se compra. La EMISIÓN, que
        es lo que crea valor monetario, está detrás de una condición: la orden
        tiene que estar pagada de verdad.

        Un pago AUTORIZADO pero no capturado no cuenta, y ése es justamente el
        estado en el que está una orden en el momento en que se anuncia como
        realizada. Un pago capturado y después anulado tampoco cuenta.

        Por eso una compra puede aparecer en el listado de entregas como pendiente
        de pago durante un rato, o para siempre si el pago nunca se captura. No es
        una entrega trabada: es la guarda haciendo su trabajo.
      `,
    },
    {
      heading: 'La programación es en hora local de la tienda',
      body: `
        La fecha y la franja que elige el comprador se interpretan en la zona
        horaria configurada acá, no en la del servidor. Cambiar esa zona cambia a
        qué hora salen las entregas que ya están programadas.

        Las tres franjas —mañana, tarde y noche— son horas concretas de esa zona, y
        el horizonte limita cuánto se puede programar hacia adelante.

        Una hora que no existe en la zona configurada, como la que se saltea en un
        cambio de horario, se rechaza al programar en vez de resolverse en
        silencio.
      `,
    },
    {
      heading: 'Reintentos y dead letter',
      body: `
        Los reintentos son exactamente cinco valores en minutos, en orden. Los que
        vienen por defecto son 1, 5, 30, 120 y 720: el último es medio día después,
        pensado para un problema del proveedor de mail y no para una dirección mal
        escrita.

        Agotados los cinco, la entrega pasa a dead letter y deja de intentarse. Con
        el aviso al comprador prendido, ahí sale UNA sola notificación avisándole
        que su regalo no llegó: es la única forma de que se entere alguien que
        pueda corregir la dirección.

        Sin ese aviso, una entrega en dead letter no le llega a nadie y sólo se ve
        filtrando el listado por ese estado.
      `,
    },
    {
      heading: 'El link de la gift card es un token cifrado',
      body: `
        El mail no lleva el código de la gift card: lleva un link con un token
        cifrado que resuelve el storefront. Las claves de ese cifrado se derivan de
        un secreto que vive en el entorno, con un mínimo de 32 caracteres, y no
        puede estar en la base porque es la clave que protege a esa misma tabla.

        El dominio del link y el segmento de país también salen del entorno, no de
        esta pantalla: son configuración regional de la instalación, compartida con
        el resto del backend. Un link a un país y precios en otro es exactamente lo
        que pasa cuando esas dos cosas se editan por separado.
      `,
    },
    {
      heading: 'El webhook de eventos de SendGrid',
      body: `
        La clave pública del webhook verifica la firma de cada evento de entrega o
        rebote que manda SendGrid. Sin ella, todos esos avisos se rechazan con 401.

        El síntoma es que las entregas quedan enviadas y nunca pasan a entregadas:
        el mail salió, y el backend no se entera de qué pasó después.

        Se copia tal cual de SendGrid, en base64 y en una sola línea. El backend la
        envuelve en PEM por su cuenta.
      `,
    },
    {
      heading: 'Diseños, marca y tienda',
      body: `
        La entrega no tiene tienda propia: la hereda de la ORDEN que la originó, y
        por eso el mail sale con la marca de la tienda que vendió la gift card.

        Los diseños funcionan al revés: un diseño sin tienda es GLOBAL y está
        disponible en todas. No es un diseño huérfano —incluye al que se siembra
        por defecto—, y sin él una tienda nueva se quedaría sin ningún diseño para
        ofrecer.

        El diseño se congela en la entrega al momento de crearla, así que editar un
        diseño no cambia el mail de una gift card ya vendida.
      `,
    },
    {
      heading: 'Avisos de saldo y de vencimiento',
      body: `
        Los dos recordatorios están apagados hasta que se les carga un valor. El de
        saldo avisa a los tantos días de la entrega si todavía queda plata sin
        usar; el de vencimiento avisa con la anticipación configurada.

        La vigencia predeterminada vacía significa SIN vencimiento, que es lo
        contrario a cero. Y sin vencimiento el aviso de vencimiento no tiene contra
        qué calcular: nunca sale.
      `,
    },
  ],
});
