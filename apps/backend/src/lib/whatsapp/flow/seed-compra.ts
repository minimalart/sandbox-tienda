import type { FlowGraph } from './graph';

/**
 * EL TRAMO DE COMPRA DEL FLUJO DE REFERENCIA (secciones 2.1 a 2.6), dibujado.
 *
 * No es un ejemplo de juguete ni una variante del recorrido base: es la traducción
 * del documento de flujo optimizado, con sus textos y sus opciones.
 *
 * ─── POR QUÉ YA NO PREGUNTA "¿QUÉ VAS A PINTAR?" ────────────────────────────
 *
 * El documento pide una pregunta de contexto antes de mostrar productos, y acá
 * estaba dibujada: un `ask_list` con ocho superficies. Pero las ocho aristas iban
 * al MISMO nodo de búsqueda y la búsqueda corría con el texto del cliente, así que
 * la respuesta se guardaba y no filtraba nada.
 *
 * Eso no es una pregunta de más: es una pregunta que MIENTE. El texto decía "quiero
 * confirmar que sea adecuado" y después ofrecía un fijador para cielorraso a quien
 * había contestado "madera" — medido por QA. Y se hacía siempre, así que comprar un
 * rodillo también obligaba a decir qué ibas a pintar.
 *
 * Filtrar de verdad necesita dos cosas que hoy no están: los atributos `advisor_*`
 * en el índice (en desdeelsur están en cero) y que `wa_search_products` acepte esos
 * filtros. Hasta entonces, el camino que SÍ filtra por superficie es el asesor
 * guiado, y el recorrido ya lo ofrece en "Ayudame a elegir".
 *
 * ─── Las tres cosas que hacen que esto funcione ──────────────────────────────
 *
 * 1. LA BÚSQUEDA NO HABLA: publica en `vars.resultados` (`save_as`) y la lista la
 *    dibuja el recorrido. Así la misma lista puede llevar, además de los productos,
 *    las filas que son del RECORRIDO y no del catálogo: "Hacer otra búsqueda",
 *    "Necesito ayuda", "Finalizar". Un carrusel no puede llevarlas.
 *
 * 2. LA LISTA SIEMPRE TIENE SALIDA. Sus tres últimas filas —"Hacer otra búsqueda",
 *    "Necesito ayuda", "Finalizar"— se dibujan aunque la búsqueda no haya traído
 *    NADA, así que el cliente nunca queda encerrado. Es la mitad importante del
 *    tramo 2.6.
 *
 * 3. AGREGAR ES SILENCIOSO. `wa_add_to_cart` no manda su propio "¿algo más?": la
 *    confirmación y sus tres botones los dibuja el recorrido, con el texto del
 *    documento, en un solo mensaje.
 *
 * ─── Qué del documento NO está acá ───────────────────────────────────────────
 *
 * Todo lo que necesita un BOTÓN CON ENLACE a la tienda: elegir color en la carta
 * tintométrica (2.3.2), "ver todos los colores" (2.3.3), "ver más resultados en la
 * tienda" (2.4.1) y "ver el catálogo" (2.6). WhatsApp los soporta, el editor todavía
 * no tiene un paso que los mande, y dibujarlos como texto con la URL pegada sería
 * una versión peor de otra cosa. Las salidas equivalentes existen —derivar a una
 * persona, volver a buscar— así que ninguna rama queda sin respuesta.
 *
 * El asesor por superficie (2.7 en adelante) tampoco: es un árbol de ocho ramas con
 * sus propias recomendaciones, y hoy lo resuelve `wa_guided_start`, al que este
 * recorrido deriva.
 *
 * Y LA PANTALLA DEDICADA DE "no encontré nada" (2.6) tampoco, por un motivo del
 * motor que vale dejar escrito: `advance()` arma el plan ENTERO del turno antes de
 * que se ejecute ninguna acción, así que una bifurcación no puede preguntar por una
 * variable que escribe una acción silenciosa de ese mismo turno — siempre la vería
 * vacía. Las opciones EN VIVO sí funcionan porque el runtime las vuelve a resolver
 * justo antes de mandar el mensaje (`freshOptions`). Para tener la pantalla propia
 * habría que darle a las bifurcaciones el mismo trato, y eso es un cambio del motor,
 * no del dibujo.
 */
export const COMPRA_GRAPH: FlowGraph = {
  nodes: [
    // ── 1. Inicio ────────────────────────────────────────────────────────────
    {
      id: 'inicio',
      type: 'start',
      label: 'Saludo',
      match: { exact: ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches'] },
      position: { x: 40, y: 40 },
    },
    {
      id: 'menu',
      type: 'ask_buttons',
      label: 'Menú principal',
      body: '¡Hola! Soy el asistente virtual 👋 ¿Qué necesitás hacer?',
      options: [
        { value: 'comprar', label: 'Comprar productos' },
        { value: 'pedido', label: 'Mi pedido' },
        { value: 'ayuda', label: 'Necesito ayuda' },
      ],
      position: { x: 40, y: 180 },
    },

    // ── 2.1 Elegir cómo buscar ───────────────────────────────────────────────
    {
      id: 'como_buscar',
      type: 'ask_buttons',
      label: 'Cómo querés buscar',
      body: '¿Cómo querés buscar?',
      options: [
        // 20 caracteres es el tope de un botón de WhatsApp: "Ya sé qué producto
        // busco" no entra y Meta lo recorta.
        { value: 'se_cual', label: 'Ya sé qué busco' },
        { value: 'ayuda_elegir', label: 'Ayudame a elegir' },
      ],
      position: { x: 360, y: 40 },
    },

    // ── 2.2 Búsqueda directa: el texto y la pregunta de contexto ─────────────
    {
      id: 'pedir_texto',
      type: 'ask_text',
      label: 'Qué busca',
      body: 'Escribime el nombre, tipo, marca o presentación 👇\nPor ejemplo: “Albalátex Design Mate Interior Blanco 20 L”, “rodillo de lana de 22 cm” o “pintura a la tiza”.',
      position: { x: 360, y: 200 },
    },
    {
      id: 'buscar',
      type: 'action',
      label: 'Buscar en el catálogo',
      tool: 'wa_search_products',
      // `{{answers.pedir_texto}}` y no `{{text}}`: la respuesta guardada del nodo, que
      // sobrevive aunque más adelante se intercale otro paso entre preguntar y buscar.
      args: { query: '{{answers.pedir_texto}}', save_as: 'resultados' },
      // No habla: deja los productos y el recorrido dibuja la lista con sus opciones.
      silent: true,
      position: { x: 360, y: 500 },
    },

    // ── 2.4 / 2.6.1 Elegir de los resultados ─────────────────────────────────
    {
      id: 'elegir_producto',
      type: 'ask_list',
      label: 'Resultados',
      body: 'Encontré estas opciones. Elegí la que querés comprar 👇',
      listButton: 'Ver opciones',
      optionsFrom: 'vars.resultados',
      // Las dibujadas son las salidas de emergencia y van DESPUÉS de los productos.
      options: [
        { value: 'otra_busqueda', label: 'Hacer otra búsqueda' },
        { value: 'ayuda', label: 'Necesito ayuda' },
        { value: 'finalizar', label: 'Finalizar conversación' },
      ],
      position: { x: 720, y: 640 },
    },
    {
      id: 'confirmar',
      type: 'ask_buttons',
      label: 'Confirmar el producto',
      body: 'Elegiste ese producto. ¿Lo agrego a tu pedido?',
      options: [
        { value: 'agregar', label: 'Agregar al carrito' },
        { value: 'volver', label: 'Volver a resultados' },
        { value: 'finalizar', label: 'Terminar' },
      ],
      position: { x: 1080, y: 640 },
    },

    // ── La cantidad, tal como la pide el documento ───────────────────────────
    {
      id: 'cantidad',
      type: 'ask_list',
      label: 'Cuántas unidades',
      body: '¿Cuántas unidades querés agregar?',
      listButton: 'Elegir cantidad',
      options: [
        { value: '1', label: '1 unidad' },
        { value: '2', label: '2 unidades' },
        { value: '3', label: '3 unidades' },
        { value: '4', label: '4 unidades' },
        { value: '5', label: '5 unidades' },
        { value: '6', label: '6 unidades' },
        { value: '7', label: '7 unidades' },
        { value: '8', label: '8 unidades' },
        { value: '9', label: '9 unidades' },
        { value: '10', label: '10 unidades' },
      ],
      position: { x: 1080, y: 820 },
    },
    {
      id: 'agregar',
      type: 'action',
      label: 'Agregar al carrito',
      tool: 'wa_add_to_cart',
      args: { variant_id: '{{answers.elegir_producto}}', quantity: '{{answers.cantidad}}' },
      // Silenciosa: la confirmación con sus tres botones la dibuja el paso siguiente,
      // en un solo mensaje. Sin esto el cliente recibía dos preguntas seguidas.
      silent: true,
      position: { x: 1080, y: 1000 },
    },
    {
      id: 'agregado',
      type: 'ask_buttons',
      label: 'Agregado',
      body: 'Listo, lo agregué a tu pedido 🛒 ¿Qué hacemos?',
      options: [
        { value: 'seguir', label: 'Seguir comprando' },
        { value: 'ver', label: 'Ver carrito' },
        { value: 'cerrar', label: 'Finalizar compra' },
      ],
      position: { x: 1080, y: 1160 },
    },

    // ── Cierre ───────────────────────────────────────────────────────────────
    {
      id: 'ver_carrito',
      type: 'action',
      label: 'Mostrar el pedido',
      // `wa_review_order` manda el detalle con sus botones; `wa_view_cart` sólo
      // devuelve texto para el modelo y en un recorrido quedaría mudo.
      tool: 'wa_review_order',
      args: {},
      position: { x: 1440, y: 1100 },
    },
    {
      id: 'link_pago',
      type: 'action',
      label: 'Generar el link de pago',
      tool: 'wa_checkout_link',
      args: { save_as: 'link_pago' },
      silent: true,
      position: { x: 1440, y: 1260 },
    },
    {
      /**
       * EL CIERRE ES SÓLO LA VARIABLE, Y ESO NO ES DESPROLIJIDAD.
       *
       * Antes decía "Tu compra está lista para continuar. Abrí el enlace 👇" y
       * después `{{vars.link_pago}}`. Eso da la compra por hecha ANTES de saber si
       * se pudo: `wa_checkout_link` puede negarse —hoy, cuando el pedido está por
       * debajo del mínimo de compra— y entonces la variable trae el motivo en vez
       * del link. Con el texto viejo el cliente leía "tu compra está lista" seguido
       * de la explicación de por qué no lo está.
       *
       * Y no alcanza con poner el texto en una bifurcación: el motor arma el plan
       * ENTERO del turno antes de ejecutar ninguna acción, así que una condición no
       * puede mirar una variable que escribe una acción silenciosa de ese mismo
       * turno. Está explicado arriba, en el encabezado del archivo.
       *
       * Quien quiera enmarcarlo con sus palabras puede, pero el texto tiene que
       * leerse bien también cuando NO hay link. Por eso el default no enmarca nada.
       */
      id: 'cerrar_compra',
      type: 'message',
      label: 'Link de pago',
      body: '{{vars.link_pago}}',
      position: { x: 1440, y: 1400 },
    },


    // ── Mi pedido ────────────────────────────────────────────────────────────
    /**
     * NÚMERO Y EMAIL, Y RECIÉN DESPUÉS EL PEDIDO.
     *
     * Antes esta rama le cedía el turno al router, que ya sabía consultar pedidos
     * pero con su propio estado y fuera del dibujo: el operador no podía cambiar un
     * texto ni probarla en el editor. Ahora las dos preguntas son del recorrido y la
     * acción sólo verifica: no muestra NADA hasta que los dos datos correspondan a la
     * misma orden, y contesta igual si el pedido no existe o si el email no coincide.
     */
    {
      id: 'pedir_numero_pedido',
      type: 'ask_text',
      label: 'Número de pedido',
      body: 'Para buscar tu pedido necesito el *número de pedido* 🔎 Lo encontrás en el mail de confirmación de la compra.',
      position: { x: 40, y: 330 },
    },
    {
      id: 'pedir_email_pedido',
      type: 'ask_text',
      label: 'Email de la compra',
      body: 'Perfecto. Ahora pasame el *email* con el que hiciste la compra, así confirmo que el pedido es tuyo.',
      position: { x: 40, y: 470 },
    },
    {
      id: 'consultar_pedido',
      type: 'action',
      label: 'Consultar el pedido',
      tool: 'wa_lookup_order',
      args: {
        order_number: '{{answers.pedir_numero_pedido}}',
        email: '{{answers.pedir_email_pedido}}',
        save_as: 'estado_pedido',
      },
      // No habla: la respuesta la escribe el paso siguiente, encontrada o no.
      silent: true,
      position: { x: 40, y: 610 },
    },
    {
      /**
       * SÓLO LA VARIABLE, por la misma razón que el cierre de la compra: la acción
       * publica acá tanto el estado del pedido como el motivo por el que no lo
       * encontró. Un "Este es tu pedido 👇" delante sería mentira en ese camino.
       */
      id: 'estado_pedido',
      type: 'message',
      label: 'Estado del pedido',
      body: '{{vars.estado_pedido}}',
      position: { x: 40, y: 750 },
    },
    {
      id: 'despues_pedido',
      type: 'ask_buttons',
      label: 'Algo más',
      body: '¿Te ayudo con algo más?',
      options: [
        { value: 'otro_pedido', label: 'Consultar otro' },
        { value: 'comprar', label: 'Comprar productos' },
        { value: 'ayuda', label: 'Necesito ayuda' },
      ],
      position: { x: 40, y: 890 },
    },

    { id: 'asesor', type: 'action', label: 'Asesor guiado', tool: 'wa_guided_start', args: {}, position: { x: 720, y: 40 } },
    { id: 'persona', type: 'handoff', label: 'Derivar', reason: 'lo pidió el cliente', position: { x: 40, y: 1040 } },
    {
      id: 'despedida',
      type: 'end',
      label: 'Despedida',
      body: '¡Gracias por escribirnos! Cuando quieras, escribime de nuevo 👋',
      position: { x: 1800, y: 1400 },
    },

    /**
     * El catch-all NO es el saludo. Si el menú atendiera todo lo que no matchea, un
     * cliente que pregunta "¿tienen sucursal en Caballito?" recibiría el menú y su
     * pregunta no llegaría nunca al router ni al modelo. Esta Entrada cede el turno.
     */
    { id: 'libre', type: 'start', label: 'Consulta libre', match: { fallback: true }, position: { x: 40, y: 1180 } },
    { id: 'ceder', type: 'end', label: 'Lo atiende el bot anterior', position: { x: 360, y: 1180 } },
  ],

  edges: [
    { id: 'e1', source: 'inicio', target: 'menu' },
    { id: 'e2', source: 'menu', target: 'como_buscar', on: 'comprar' },
    { id: 'e3', source: 'menu', target: 'pedir_numero_pedido', on: 'pedido' },
    { id: 'e4', source: 'menu', target: 'persona', on: 'ayuda' },

    { id: 'e5', source: 'como_buscar', target: 'pedir_texto', on: 'se_cual' },
    { id: 'e6', source: 'como_buscar', target: 'asesor', on: 'ayuda_elegir' },

    { id: 'e7', source: 'pedir_texto', target: 'buscar' },

    { id: 'e16', source: 'buscar', target: 'elegir_producto' },

    // Sin `on`: lo que el cliente elija de la parte EN VIVO (los productos).
    { id: 'e19', source: 'elegir_producto', target: 'confirmar' },
    { id: 'e20', source: 'elegir_producto', target: 'pedir_texto', on: 'otra_busqueda' },
    { id: 'e21', source: 'elegir_producto', target: 'persona', on: 'ayuda' },
    { id: 'e22', source: 'elegir_producto', target: 'despedida', on: 'finalizar' },

    { id: 'e23', source: 'confirmar', target: 'cantidad', on: 'agregar' },
    { id: 'e24', source: 'confirmar', target: 'elegir_producto', on: 'volver' },
    { id: 'e25', source: 'confirmar', target: 'despedida', on: 'finalizar' },

    { id: 'e26', source: 'cantidad', target: 'agregar', on: '1' },
    { id: 'e27', source: 'cantidad', target: 'agregar', on: '2' },
    { id: 'e28', source: 'cantidad', target: 'agregar', on: '3' },
    { id: 'e29', source: 'cantidad', target: 'agregar', on: '4' },
    { id: 'e30', source: 'cantidad', target: 'agregar', on: '5' },
    { id: 'e31', source: 'cantidad', target: 'agregar', on: '6' },
    { id: 'e32', source: 'cantidad', target: 'agregar', on: '7' },
    { id: 'e33', source: 'cantidad', target: 'agregar', on: '8' },
    { id: 'e34', source: 'cantidad', target: 'agregar', on: '9' },
    { id: 'e35', source: 'cantidad', target: 'agregar', on: '10' },

    { id: 'e36', source: 'agregar', target: 'agregado' },
    { id: 'e37', source: 'agregado', target: 'pedir_texto', on: 'seguir' },
    { id: 'e38', source: 'agregado', target: 'ver_carrito', on: 'ver' },
    { id: 'e39', source: 'agregado', target: 'link_pago', on: 'cerrar' },
    // Después de mostrar el pedido, el cliente contesta y vuelve acá a decidir.
    { id: 'e40', source: 'ver_carrito', target: 'agregado' },
    { id: 'e41', source: 'link_pago', target: 'cerrar_compra' },
    { id: 'e42', source: 'cerrar_compra', target: 'despedida' },


    // El asesor guiado se queda con la conversación: hace sus propias preguntas por
    // el router. El recorrido le cede el turno y no vuelve.
    { id: 'e46', source: 'asesor', target: 'ceder' },

    { id: 'e48', source: 'pedir_numero_pedido', target: 'pedir_email_pedido' },
    { id: 'e49', source: 'pedir_email_pedido', target: 'consultar_pedido' },
    { id: 'e50', source: 'consultar_pedido', target: 'estado_pedido' },
    { id: 'e51', source: 'estado_pedido', target: 'despues_pedido' },
    // "Consultar otro" también es el reintento cuando el número o el email no coinciden.
    { id: 'e52', source: 'despues_pedido', target: 'pedir_numero_pedido', on: 'otro_pedido' },
    { id: 'e53', source: 'despues_pedido', target: 'como_buscar', on: 'comprar' },
    { id: 'e54', source: 'despues_pedido', target: 'persona', on: 'ayuda' },
    { id: 'e47', source: 'libre', target: 'ceder' },
  ],
};
