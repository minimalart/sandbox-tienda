import { defineHelp } from './types';

/**
 * El motor de recomendaciones tiene DOS pantallas y la confusión entre ellas es
 * la fuente de casi todo lo que se pregunta: acá está la OPERACIÓN (cuánto CPU
 * puede gastar, cada cuánto, con qué secreto firma) y en la pantalla de
 * recomendaciones está el PRODUCTO (qué se le muestra al comprador). Hasta hoy
 * eso sólo estaba escrito en la nota 3 del encabezado del descriptor, y el
 * síntoma es el toggle "Motor activo", que existe en las dos y no significa lo
 * mismo.
 *
 * El gotcha caro no es una perilla sino un incidente: el motor corre DENTRO del
 * web service, en el mismo vCPU que el HTTP server. Todas las perillas de
 * "Recálculo" son negociaciones contra ese vCPU, y sin esa frase de contexto se
 * leen como números arbitrarios que conviene subir.
 */
export default defineHelp({
  title: 'Motor de recomendaciones',
  summary:
    'Acá se configura la operación del motor: cuánto trabajo hace, cada cuánto y con qué límites.',
  sections: [
    {
      heading: 'Esta pantalla no decide qué ve el comprador',
      body: `
        Hay dos capas y están a propósito separadas. Acá vive la OPERACIÓN: cuánto
        CPU puede morder una corrida, cada cuánto se recalcula, cuántas consultas
        por minuto se aceptan, con qué secreto se firman los eventos.

        Lo que se le muestra al comprador —cuántos productos por bloque, qué
        estrategia, los umbrales, los mensajes de envío gratis— vive en la pantalla
        de recomendaciones y se guarda por tienda.

        Si lo que querés cambiar es lo que aparece en la ficha de producto, esta no
        es la pantalla.
      `,
    },
    {
      heading: 'Las relaciones manuales le ganan a todo',
      body: `
        Las relaciones que se cargan a mano tienen prioridad sobre las calculadas y
        NO se pisan con los recálculos automáticos.

        Es lo que hace que las recomendaciones funcionen desde el día uno, sin
        historial de órdenes: una instalación nueva no tiene co-compras que
        analizar, pero sí puede tener criterio.

        El resto de las estrategias se encadenan: si una no tiene datos, se sigue
        con la siguiente, y la cadena termina siempre en más vendidos. Por eso un
        bloque casi nunca aparece vacío, y por eso un bloque que muestra siempre lo
        mismo suele significar que las estrategias de arriba todavía no calcularon.
      `,
    },
    {
      heading: 'El motor corre en el mismo procesador que la tienda',
      body: `
        No hay un worker aparte: el motor corre DENTRO del web service, compartiendo
        un vCPU con el servidor HTTP que atiende a los compradores.

        Por eso todas las perillas de recálculo son negociaciones contra ese vCPU y
        no números a maximizar. El 23 de julio de 2026 un presupuesto alto clavó el
        procesador al 100 por ciento hasta que la plataforma mató el contenedor en
        loop. Ese incidente es el motivo de que existan los topes duros.

        Los topes que acotan los límites que el merchant edita en la pantalla de
        recomendaciones NO están acá, y no es un olvido: se cambian por entorno,
        con un deploy que alguien tiene que aprobar. Ponerlos en la misma pantalla
        que acotan sería dejar al guardia adentro de la caja que vigila, porque el
        primer reflejo ante "me lo guardó en 24" es subir el tope.
      `,
    },
    {
      heading: 'Los dos interruptores que se llaman igual',
      body: `
        El motor activo de esta pantalla es el corte de luz de la instalación
        entera: apagado, la ruta pública devuelve vacío y la ingesta de eventos se
        descarta sin leer configuración ni tocar la base.

        El motor activo de la pantalla de recomendaciones es otra cosa: es por
        tienda y se guarda en la configuración del motor. El de acá le gana a todo.

        Las tareas programadas son un interruptor aparte y más suave: apaga los
        cuatro jobs —encolar, recalcular, agregar métricas y purgar— sin apagar el
        servicio, así que la tienda sigue mostrando las recomendaciones ya
        calculadas. Es la palanca para descomprimir el procesador en un pico sin
        quedarse sin recomendaciones. Apagar el motor apaga también los jobs; al
        revés no.
      `,
    },
    {
      heading: 'Diagnóstico en la respuesta pública',
      body: `
        Agrega a la respuesta de la ruta PÚBLICA el detalle de cómo se armó la
        recomendación: la cadena de fallbacks recorrida, la estrategia que ganó,
        cuántos candidatos se descartaron.

        Deja de ser un detalle interno. Cualquiera que abra el panel de red del
        navegador ve cómo se arma el catálogo. Prendelo para diagnosticar y apagalo
        cuando termines.
      `,
    },
    {
      heading: 'Cómo funciona el recálculo',
      body: `
        El recálculo no corre entero de una vez. Un job encola los recálculos
        pendientes y otro drena la cola ejecutando UNA corrida por tick.

        Cada corrida tiene un presupuesto de tiempo. Cuando se agota, guarda su
        cursor y devuelve que sigue en progreso: el próximo tick la continúa desde
        donde quedó. Eso es lo que permite recalcular un catálogo entero desde un
        solo procesador sin bloquear al servidor HTTP.

        El corte por reloj ocurre ENTRE lotes, no adentro de uno. Por eso lotes muy
        grandes amortizan mejor las consultas pero alargan el tramo en el que la
        corrida no puede chequear su presupuesto.

        Una corrida terminada no pasa a servir automáticamente. Si queda lista pero
        no llega a activarse, casi siempre es que no se alcanzó el mínimo de órdenes
        analizadas: la versión anterior sigue sirviendo y no hay nada roto.

        Los minutos sin progreso son la reconciliación: un deploy o una caída a
        mitad de un build deja una corrida marcada como en curso que nadie va a
        retomar, y el encolador no encola si ya hay una pendiente. Sin esa
        reconciliación la estrategia queda bloqueada para siempre. Tiene que ser
        holgadamente mayor que el presupuesto por corrida, o se van a matar builds
        que estaban avanzando bien.
      `,
    },
    {
      heading: 'Servicio y límites por request',
      body: `
        El límite de consultas por minuto se cuenta POR PROCESO: con varias
        réplicas el efectivo es esa cifra multiplicada por la cantidad de réplicas.
        Sirve para acotar el daño de un script, no para hacer cuotas. Es generoso
        porque una sola ficha de producto dispara varios bloques y un usuario
        navegando rápido es legítimo.

        La vigencia de la configuración en memoria es lo que evita que cada request
        cueste tres o cuatro lecturas antes de empezar a trabajar. Con varias
        réplicas, ese número es el desfase máximo de un cambio hecho en el
        backoffice. Lo que necesita efecto inmediato, como el cambio de versión
        activa, invalida a mano y no espera.

        El secreto de firma de eventos firma el identificador que viaja en cada
        respuesta y vuelve en cada evento: uno forjado se rechaza sin tocar la base.
        Vacío, se usa el secreto de cookies del proyecto. Rotarlo pierde la
        atribución de las visitas en vuelo de los minutos siguientes, nada
        histórico.
      `,
    },
    {
      heading: 'Retención y métricas',
      body: `
        La agregación recalcula una ventana rodante entera cada hora en vez de sólo
        el período que acaba de cerrar. Eso es lo que hace que se autocorrijan las
        órdenes canceladas, los eventos que llegan tarde y las corridas que
        fallaron, sin lógica de reconciliación aparte. Achicarla ahorra procesador y
        deja huecos; agrandarla es recalcular lo mismo muchas veces.

        Los borrados de la purga son DUROS: la tabla de eventos es la de mayor
        volumen de la extensión y un borrado lógico no libera espacio. Las filas por
        lote son lo que acota el bloqueo de esa tabla, así que subirlas mucho
        convierte la purga nocturna en un incidente.

        Si la purga agota sus lotes, corta y deja el resto para mañana: es
        idempotente y reentrante. Después de una limpieza grande o de importar
        historia conviene subir el tope de lotes temporalmente, en vez de esperar
        semanas a que se ponga al día.
      `,
    },
  ],
});
