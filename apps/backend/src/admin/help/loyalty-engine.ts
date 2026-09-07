import { defineHelp } from './types';

/**
 * Fidelización es el caso inverso al de Typesense: acá el problema no es que el
 * modelo mental esté escondido en un campo, sino que la pantalla de ajustes
 * muestra UNA variable —la tasa legacy— y el 95% de la extensión vive en tablas
 * propias que se editan en otras cinco sub-páginas. El operador que abre
 * "Configuración" no tiene forma de saber que las reglas, los niveles, las
 * recompensas y las campañas son la extensión de verdad.
 *
 * El gotcha caro sale del encabezado de `descriptors/loyalty-engine.ts` y del
 * `help` de POINTS_EARN_RATE, y hoy está dicho dos veces con palabras distintas:
 * apenas existe un programa activo, ese número DEJA de mirarse. Alguien lo
 * cambia, guarda, y no pasa absolutamente nada — sin error y sin aviso.
 */
export default defineHelp({
  title: 'Fidelización',
  summary: 'Programa de puntos por tienda con reglas de acumulación, niveles, campañas y recompensas canjeables.',
  sections: [
    {
      heading: 'Casi nada de esto se configura en la pantalla de ajustes',
      body: `
        El grueso de la fidelización NO es configuración de entorno: el programa,
        las reglas de acumulación, los niveles, las recompensas y las campañas
        viven en tablas propias del módulo y se editan en las sub-páginas de
        Fidelización.

        Lo único que hay en la card de ajustes es la tasa de acumulación del
        sistema VIEJO, el anterior al motor de reglas. Está abajo del programa y
        no arriba justamente por eso: no es el ajuste principal.
      `,
    },
    {
      heading: 'La tasa legacy y el programa no conviven',
      body: `
        La tasa de acumulación legacy se usa SÓLO mientras no haya un programa
        activo. Apenas existe uno, mandan sus reglas y ese número deja de
        mirarse.

        Es la falla más cara de esta extensión porque no rompe nada: alguien
        cambia la tasa, guarda, ve el toast de éxito y la acumulación sigue
        exactamente igual. No hay error, no hay alerta. Si tocaste la tasa y no
        cambió nada, mirá si hay un programa activo.

        El rango del campo tampoco es decorativo. Un 10 donde iba 0,10 multiplica
        la acumulación por cien, los puntos son canjeables, y el regalo se
        descubre cuando los clientes ya los gastaron.
      `,
    },
    {
      heading: 'Cómo se calcula lo que suma un cliente',
      body: `
        Cada regla de acumulación tiene un tipo de cálculo: puntos fijos,
        porcentaje sobre el monto elegible, o multiplicador. Encima de eso se
        apilan el multiplicador del nivel del cliente y el de la campaña vigente.

        El resultado se trunca a puntos enteros y nunca es negativo. Por eso una
        tasa fraccionaria no se expresa como tasa sino como regla de porcentaje:
        "1 punto cada 10 pesos" es una regla de porcentaje con valor 10.

        Las reglas también filtran por condiciones —monto mínimo, canal de venta,
        categorías, colecciones, marcas, clientes, ventana de fechas— y tienen
        límites por cliente, por día y por campaña.
      `,
    },
    {
      heading: 'El nivel de un cliente se deriva, no se asigna',
      body: `
        Un nivel declara una condición (gasto acumulado, puntos o cantidad de
        órdenes) y un umbral. El cliente queda en el MEJOR nivel cuyo umbral
        alcanzó, y si empata dos, gana el de multiplicador más alto.

        No hay forma de poner a un cliente en un nivel a mano: si las métricas no
        llegan al umbral, no hay nivel. Un nivel sin nadie adentro casi siempre es
        un umbral mal puesto, no un problema de datos.
      `,
    },
    {
      heading: 'Recompensas: qué las bloquea',
      body: `
        Una recompensa se puede canjear sólo si está activa, está dentro de su
        ventana de vigencia, le queda stock y el cliente tiene los puntos. Cada
        uno de esos cuatro frena el canje con su propio mensaje.

        Según el tipo, el canje produce cosas distintas: descuento fijo,
        porcentaje, envío gratis y producto gratis se resuelven como una
        promoción de Medusa; el saldo a favor se acredita como store credit; el
        tipo personalizado no genera ningún beneficio automático y hay que
        operarlo a mano.
      `,
    },
    {
      heading: 'El vencimiento de puntos',
      body: `
        La política del programa decide si los puntos no vencen, vencen a los N
        días o vencen a fin de año. Quien la ejecuta es un job programado.

        La frecuencia de ese job se hornea al arrancar y NO se puede cambiar desde
        el admin: es LOYALTY_EXPIRE_SCHEDULE, una variable de entorno, y el
        scheduler no la vuelve a consultar. Cambiarla es cambiar el entorno y
        reiniciar.
      `,
    },
    {
      heading: 'El programa es por tienda',
      body: `
        Cada tienda puede tener su propio programa, con sus propias reglas y sus
        propios niveles, y por eso la tasa legacy también es por tienda. El
        selector de arriba decide cuál se está editando.

        En esta pantalla el cambio de tienda es en caliente, sin recargar. Si
        tenías un borrador sin guardar, la franja lo avisa antes de cambiar: el
        formulario guarda POR ID de programa, así que un borrador que sobreviviera
        al cambio escribiría en el programa de la tienda anterior, que ni siquiera
        está en pantalla.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        El primer paso es el que decide todo lo demás: sin programa activo, las
        reglas, los niveles y las campañas no se evalúan y lo único que corre es
        la tasa legacy.
      `,
      steps: [
        'Elegir la tienda en el selector de arriba y crear el programa: nombre, cómo se llaman los puntos, moneda y política de vencimiento.',
        'Dejarlo en estado Activo. Mientras esté inactivo sigue rigiendo la tasa legacy.',
        'Cargar al menos una regla de acumulación en Reglas, con su tipo de cálculo y sus condiciones.',
        'Opcional: definir niveles en Niveles, con la condición y el umbral de cada uno. El multiplicador del nivel se apila sobre el de la regla.',
        'Cargar recompensas en Recompensas, con su costo en puntos, su vigencia y su stock.',
        'Hacer una compra de prueba y verificar en Movimientos que se acreditaron los puntos esperados.',
        'Verificar el canje de una recompensa de punta a punta antes de comunicarlo.',
      ],
    },
  ],
});
