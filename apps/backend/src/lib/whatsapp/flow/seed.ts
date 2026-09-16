import type { FlowGraph } from './graph';

/**
 * El recorrido que el bot atiende HOY, dibujado como grafo.
 *
 * No es un ejemplo de juguete: replica el menú de `sendMainMenu`, el sub-flujo de
 * compra de `handleAction` y el de estado de pedido, con los mismos textos. Es lo
 * que permite que el editor arranque de algo reconocible en vez de un canvas vacío
 * — y, sobre todo, es la referencia contra la cual comparar cuando se apague el
 * router viejo: si el grafo semilla no cubre un camino, ese camino se pierde.
 *
 * ─── Las dos reglas que no son obvias ─────────────────────────────────────────
 *
 * 1. EL CATCH-ALL NO ES EL SALUDO. El grafo exige exactamente un `start` marcado
 *    como `fallback`, y si ese es el del menú se traga todo el texto libre: el
 *    cliente pregunta "¿tienen sucursales en provincia?" y le contesta el menú, sin
 *    que el router ni el modelo lleguen a verlo nunca. Acá el saludo entra por
 *    `keywords` y el catch-all es `libre`, que sale del grafo en silencio.
 *
 * 2. EL TAP DE PRODUCTO NO ES UNA OPCIÓN DEL GRAFO. El "Agregar" del carrusel viaja
 *    como `variant_<id>`, no como `flow:<nodo>:<valor>`. Se lee con
 *    `{{vars.selected_variant}}` y se rutea con la condición sobre
 *    `vars.selected_variant` (ver `rememberSelection`). Antes esto no existía y el
 *    recorrido descartaba el tap: se podía buscar, pero NO comprar.
 */
export const SEED_GRAPH: FlowGraph = {
  nodes: [
    {
      id: 'inicio',
      type: 'start',
      label: 'Saludo',
      // `exact` y no `keywords`: un saludo sólo es un saludo cuando el mensaje no
      // dice nada más. Con `keywords`, "Hola! ¿Tienen sucursales en CABA?" abría el
      // menú y la pregunta se perdía.
      match: {
        exact: ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'menu', 'empezar'],
      },
      position: { x: 40, y: 40 },
    },
    {
      id: 'libre',
      type: 'start',
      label: 'Consulta libre',
      // El catch-all. No contesta: cede el turno para que lo atienda el router
      // (carrito, sucursales, pedidos) o el modelo.
      match: { fallback: true },
      position: { x: 40, y: 520 },
    },
    {
      id: 'menu',
      type: 'ask_buttons',
      label: 'Menú principal',
      body: '¡Hola! 👋 ¿En qué puedo ayudarte?',
      // Tres, que es el máximo de WhatsApp. Sucursales y devoluciones se ofrecen
      // dentro de cada recorrido, igual que hoy.
      options: [
        { value: 'buy', label: 'Comprar productos' },
        { value: 'help', label: 'Necesito ayuda' },
        { value: 'orders', label: 'Mi pedido' },
      ],
      position: { x: 40, y: 160 },
    },

    // ── Comprar ───────────────────────────────────────────────────────────────
    {
      id: 'sabe_producto',
      type: 'ask_buttons',
      label: '¿Sabe qué busca?',
      body: '¿Sabés qué producto estás buscando?',
      options: [
        { value: 'known', label: 'Sí, sé cuál' },
        { value: 'help', label: 'Necesito ayuda' },
      ],
      position: { x: 340, y: 100 },
    },
    {
      id: 'que_busca',
      type: 'ask_text',
      label: 'Qué busca',
      body: 'Decime qué estás buscando y te muestro lo que tenemos. 🔎',
      position: { x: 640, y: 40 },
    },
    {
      id: 'buscar',
      type: 'action',
      label: 'Buscar productos',
      tool: 'wa_search_products',
      args: { query: '{{text}}' },
      position: { x: 940, y: 40 },
    },

    // ── Carrito ───────────────────────────────────────────────────────────────
    {
      id: 'agregar',
      type: 'action',
      label: 'Agregar al carrito',
      tool: 'wa_add_to_cart',
      args: { variant_id: '{{vars.selected_variant}}' },
      // Silencioso a propósito: la tool cerraría el turno con sus propios botones
      // ("Algo más"/"Cerrar compra"), que los entiende el router y no el grafo. Acá
      // la pregunta la hace el nodo de al lado, en el MISMO mensaje.
      silent: true,
      position: { x: 1240, y: 40 },
    },
    {
      id: 'que_sigue',
      type: 'ask_buttons',
      label: '¿Sigue comprando?',
      body: '¡Listo, lo agregué a tu pedido! 🛒 ¿Qué hacemos?',
      options: [
        { value: 'mas', label: 'Agregar algo más' },
        { value: 'cerrar', label: 'Cerrar compra' },
        { value: 'no', label: 'Dejarlo acá' },
      ],
      position: { x: 1540, y: 40 },
    },
    {
      id: 'cerrar',
      type: 'action',
      label: 'Revisar y pagar',
      // Muestra el detalle con los botones "Confirmar pago"/"Cambiar". Esos taps
      // son del router, que ya sabe generar y MANDAR el link — `wa_checkout_link`
      // por sí sola devuelve el link pero no se lo envía al cliente.
      tool: 'wa_review_order',
      args: {},
      position: { x: 1840, y: 120 },
    },

    // ── Ayuda ─────────────────────────────────────────────────────────────────
    {
      id: 'ayuda',
      type: 'ask_buttons',
      label: '¿Qué tipo de ayuda?',
      body: '¿Te ayudo a encontrar el producto o preferís hablar con alguien del equipo?',
      options: [
        { value: 'asesor', label: 'Ayudame a elegir' },
        { value: 'persona', label: 'Hablar con alguien' },
      ],
      position: { x: 340, y: 260 },
    },
    {
      id: 'asesor',
      type: 'action',
      label: 'Asesor guiado',
      tool: 'wa_guided_start',
      args: {},
      position: { x: 640, y: 260 },
    },
    {
      id: 'persona',
      type: 'handoff',
      label: 'Derivar a una persona',
      reason: 'lo pidió el cliente',
      position: { x: 640, y: 380 },
    },

    // ── Mi pedido ─────────────────────────────────────────────────────────────
    {
      id: 'pedido',
      type: 'action',
      label: 'Estado del pedido',
      // Devuelve la consulta al router con su propio id (`act:orders`), que es el
      // que sabe verificar identidad antes de mostrar nada.
      tool: 'wa_ask_buttons',
      args: {
        body: 'Te muestro cómo viene tu pedido 📦',
        buttons: [{ label: 'Ver mi pedido', action: 'orders' }],
      },
      position: { x: 340, y: 380 },
    },

    // ── Salidas ───────────────────────────────────────────────────────────────
    {
      id: 'salida',
      type: 'end',
      label: 'Sigue fuera del recorrido',
      // Sin texto a propósito: un final mudo no le responde nada al cliente y deja
      // que el turno lo atienda el router o el modelo.
      position: { x: 2140, y: 300 },
    },
    {
      id: 'fin',
      type: 'end',
      label: 'Fin',
      body: '¡Gracias por escribirnos! Cuando quieras, escribime de nuevo. 👋',
      position: { x: 1840, y: 300 },
    },
  ],
  edges: [
    { id: 'e_inicio', source: 'inicio', target: 'menu' },
    { id: 'e_libre', source: 'libre', target: 'salida' },

    { id: 'e_buy', source: 'menu', target: 'sabe_producto', on: 'buy' },
    { id: 'e_help', source: 'menu', target: 'ayuda', on: 'help' },
    { id: 'e_orders', source: 'menu', target: 'pedido', on: 'orders' },

    { id: 'e_ayuda_asesor', source: 'ayuda', target: 'asesor', on: 'asesor' },
    { id: 'e_ayuda_persona', source: 'ayuda', target: 'persona', on: 'persona' },

    { id: 'e_known', source: 'sabe_producto', target: 'que_busca', on: 'known' },
    // Desde la compra va derecho al asesor: ya está buscando un producto, no tiene
    // sentido volver a preguntarle qué tipo de ayuda quiere.
    { id: 'e_sabe_help', source: 'sabe_producto', target: 'asesor', on: 'help' },

    { id: 'e_que_busca', source: 'que_busca', target: 'buscar' },

    // El orden no importa —el motor prueba las condicionales antes que la
    // incondicional—, pero se dibuja primero la que sí lleva a la compra.
    {
      id: 'e_elegido',
      source: 'buscar',
      target: 'agregar',
      when: { path: 'vars.selected_variant', op: 'exists' },
    },
    { id: 'e_sin_elegir', source: 'buscar', target: 'salida' },

    { id: 'e_agregado', source: 'agregar', target: 'que_sigue' },
    { id: 'e_mas', source: 'que_sigue', target: 'que_busca', on: 'mas' },
    { id: 'e_cerrar', source: 'que_sigue', target: 'cerrar', on: 'cerrar' },
    { id: 'e_no', source: 'que_sigue', target: 'fin', on: 'no' },
    { id: 'e_pagar', source: 'cerrar', target: 'salida' },

    { id: 'e_asesor', source: 'asesor', target: 'salida' },
    { id: 'e_pedido', source: 'pedido', target: 'salida' },
  ],
};
