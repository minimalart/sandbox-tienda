import { defineHelp } from './types';

/**
 * Delivery es el caso que motivó este módulo: el `help` de `GOOGLE_MAPS_API_KEY`
 * en `descriptors/delivery.ts` tiene 480 caracteres —el peor del repo— y adentro
 * conviven tres cosas distintas: qué hace el campo, qué API hay que habilitar en
 * Google Cloud, y la advertencia de que esa key NO alimenta ningún mapa. Sólo la
 * primera es ayuda de campo; las otras dos son de la EXTENSIÓN y por eso bajan
 * acá, a dos secciones propias.
 *
 * El modelo mental (DeliveryExecution como sidecar del Fulfillment) y los límites
 * conocidos vienen de `docs/recipes/delivery-own-fleet.md`, que hasta hoy era la
 * única forma de enterarse: una receta que el operador no sabe que existe.
 */
export default defineHelp({
  title: 'Delivery',
  summary:
    'Capa de operación logística para flota propia: zonas, repartidores, vehículos, reglas y rutas.',
  sections: [
    {
      heading: 'El modelo mental',
      body: `
        Medusa sigue siendo el dueño de la verdad comercial: la orden, el pago, la
        opción de envío y el fulfillment con sus estados creado, enviado y
        entregado. Delivery agrega al lado una capa de operación que no duplica
        nada de eso.

        La entidad central es la ejecución de entrega: un acompañante uno a uno de
        cada fulfillment. No copia la dirección ni los ítems del pedido —los lee en
        vivo— y sólo guarda el estado operativo fino (asignado, retirado, en ruta,
        entregado) más las referencias a repartidor, vehículo, ruta y zona.

        Por eso todo empieza en el fulfillment. Cuando se crea uno de flota propia,
        se crea su ejecución, se clasifica la zona, se evalúan las reglas, se
        calcula qué recursos son elegibles y recién ahí se asigna o se arma la
        ruta.
      `,
    },
    {
      heading: 'Por qué una compra no aparece en Delivery',
      body: `
        Es la consulta número uno de esta extensión y casi siempre es lo mismo: sin
        el auto-fulfillment de flota propia prendido, las compras con envío por
        flota propia NO generan fulfillment solas, y sin fulfillment nunca hay
        ejecución de entrega. Medusa no crea el fulfillment de una orden normal.

        El otro motivo, más difícil de ver, es de despliegue: los subscribers que
        crean el fulfillment y la ejecución sólo corren en el backend que ejecuta
        el código desplegado. Si el deploy quedó atrasado respecto de main, el
        código existe en el repo y no se ejecuta en ningún lado. Antes de tocar
        configuración, confirmá qué commit está corriendo.
      `,
    },
    {
      heading: 'La API key de Google Maps no alimenta los mapas',
      body: `
        Lo que se guarda acá gobierna el geocoding de RESPALDO del backend: el que
        resuelve latitud y longitud cuando el storefront no las capturó, para poder
        asignar zona y sucursal.

        Los mapas son otra cosa. El del admin lee su key del entorno de build de
        Vite y el del storefront la lee del entorno de build de Next: ninguno de los
        dos consulta la base. O sea que la variable tiene que seguir estando en el
        entorno de build de cada app, aunque la key ya esté cargada en esta
        pantalla.

        Es una credencial de la instalación, no de cada tienda: es la key de UN
        proyecto de Google Cloud. Y se factura por request contra la cuenta del
        cliente, así que una key filtrada no se roba datos, se roba plata, y el
        primer síntoma es la factura del mes siguiente.

        En Google Cloud hay que habilitar la Geocoding API. Sin eso Google responde
        REQUEST_DENIED y el geocoding queda apagado de hecho, sin romper nada: la
        dirección simplemente queda sin zona.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        El orden importa: los seeds dependen unos de otros y los subscribers se
        cargan al arrancar.
      `,
      steps: [
        'Confirmar que el backend desplegado corre el código con los subscribers de flota propia, y reiniciarlo después de actualizar.',
        'Prender el auto-fulfillment de flota propia en esta pantalla. Sin esto no entra ninguna compra.',
        'Cargar la API key de Google Maps con la Geocoding API habilitada, si las direcciones del storefront no traen coordenadas.',
        'Correr las migraciones del módulo.',
        'Correr los seeds en orden: base, sucursales, opción de envío de flota propia, datos de flota y polígonos de cobertura.',
        'Reiniciar el backend para cargar subscribers y workflows, y el storefront si cambiaron las regiones.',
        'Verificar con el smoke test de delivery, que es de sólo lectura y reporta eslabón por eslabón.',
        'Probar de punta a punta: pedido con envío de flota propia, ver que aparezca la ejecución con sucursal y zona resueltas, auto-asignar y auto-armar rutas.',
      ],
    },
    {
      heading: 'Elegibilidad, frío y turnos',
      body: `
        Antes de asignar, el sistema calcula qué repartidores y vehículos PUEDEN
        llevar una entrega, y guarda el motivo de cada rechazo: fuera de turno,
        sobrecargado, sin frío, zona no habilitada. Ese detalle está en el botón de
        ver candidatos y es la mejor herramienta de diagnóstico de la extensión.

        La temperatura funciona así: un producto se marca como refrigerado o
        congelado en la metadata de la variante, el requisito de una entrega es el
        MÁXIMO de frío de sus ítems, y un vehículo sólo puede llevarla si soporta
        ese modo. No es una preferencia, es un filtro duro.

        Las zonas se resuelven por sucursal, no por geometría, salvo que la zona
        tenga un polígono de cobertura cargado.
      `,
    },
    {
      heading: 'Límites conocidos',
      body: `
        El recargo de las reglas NO se le cobra al cliente. Las reglas se evalúan
        DESPUÉS del checkout, así que el recargo se guarda como costo operativo
        estimado y no como cargo. Cobrarlo pide moverlo al checkout.

        "Delivery más barato" es una heurística, no una comparación de tarifas en
        vivo: una regla fuerza un proveedor según condiciones, y el sistema no
        cotiza contra los carriers en tiempo real.

        La auto-asignación es por botón. No se dispara sola al crear el pedido.
      `,
    },
  ],
});
