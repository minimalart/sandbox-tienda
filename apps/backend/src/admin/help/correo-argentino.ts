import { defineHelp } from './types';

/**
 * Correo es la extensión con más variables del repo (42) y la que más se
 * equivoca al clasificar. El encabezado de `descriptors/correo-argentino.ts`
 * explica las tres decisiones de fondo —el reparto tienda/instancia, la doble
 * capa de credenciales y por qué el número de acuerdo es la variable más
 * peligrosa del namespace— y ninguna de las tres es de un campo: son del modelo
 * de la extensión. Hasta hoy sólo estaban en un comentario que el operador no
 * lee nunca.
 *
 * El gotcha caro va en su propia sección: sin las TRES credenciales de MiCorreo
 * no hay cotización, y el síntoma no es un error sino un checkout que dice
 * "Gratuito". Hoy esa frase está en el `help` de un solo campo —el de la
 * contraseña—, que es exactamente el último lugar donde alguien la va a leer.
 */
export default defineHelp({
  title: 'Correo Argentino',
  summary: 'Cotiza tarifas con MiCorreo y da de alta los envíos contra paqar, con seguimiento.',
  sections: [
    {
      heading: 'Son dos APIs distintas, con credenciales distintas',
      body: `
        Correo no expone un solo servicio. paqar es el que da de ALTA los envíos y
        se autentica con la API key. MiCorreo es el que COTIZA y se autentica con
        usuario, contraseña y Customer ID. Son cuentas separadas y se piden por
        separado.

        La consecuencia práctica: sin usuario, contraseña y Customer ID de
        MiCorreo, todo envío degrada a cero y el checkout muestra "Gratuito". No
        hay error, no hay alerta y la tienda vende con el flete regalado hasta que
        alguien mira una orden. Es la falla más cara de esta extensión.

        Y hay una tercera forma de terminar en "Gratuito" que no se arregla con
        credenciales: que MiCorreo autentique bien pero devuelva la cotización
        VACÍA porque la cuenta no está activada comercialmente. Ahí no hay nada que
        tocar en esta pantalla; hay que pedirle a Correo la activación del acuerdo.

        El usuario de MiCorreo es por INTEGRADOR, no por comerciante: la identidad
        del comercio viaja toda en el Customer ID. Dos tiendas del mismo backend
        comparten usuario y se diferencian por Customer ID.

        La API key de paqar tiene además un efecto de arranque: el módulo se
        registra como proveedor de envío únicamente cuando esa clave está seteada.
        Si Correo no aparece en la lista de proveedores, el problema es ese y no la
        configuración de las opciones de envío.

        Los hosts también están separados a propósito. El caso real es operar en
        prueba y cotizar en producción, porque el sandbox de MiCorreo suele no
        responder.
      `,
    },
    {
      heading: 'El número de acuerdo es lo más delicado de esta pantalla',
      body: `
        El acuerdo comercial viaja como header en CADA request a paqar, queda
        estampado en el fulfillment y el número de seguimiento propio se deriva de
        él.

        Una tienda despachando contra el acuerdo de otra le factura el flete a un
        CUIT ajeno, y una colisión de números de seguimiento dentro de un mismo
        acuerdo es IRRECUPERABLE. Por eso es un ajuste por tienda y por eso también
        se puede cargar como credencial de tienda: en multitienda, verificá que el
        selector de arriba esté en la tienda correcta antes de guardarlo.
      `,
    },
    {
      heading: 'Qué es de la tienda y qué de la instalación',
      body: `
        Casi todo Correo es del COMERCIANTE: el acuerdo, la dirección de despacho,
        el remitente, el tipo de servicio contratado. En multitienda cada tienda
        tiene el suyo y por eso son ajustes por tienda.

        Lo que NO varía por tienda es a qué servidor se le pega (modo de prueba,
        los dos hosts, los dos paths base), qué unidad de peso usa el catálogo
        —que es uno solo para toda la instancia— y los techos físicos que impone la
        API. Esos son de la instalación.

        Cinco credenciales viven además en el catálogo de credenciales por tienda,
        y ese valor GANA sobre lo que se cargue acá. No es duplicación: son dos
        sistemas de cifrado con dos claves distintas, a propósito. Si cambiaste un
        valor acá y no pasó nada, mirá si esa tienda tiene su propia credencial
        cargada.
      `,
    },
    {
      heading: 'Modo de prueba',
      body: `
        Apunta las dos APIs al entorno de test de Correo. Los envíos creados ahí NO
        existen para Correo: sirven para integrar, no para despachar.

        Es un ajuste de la instalación, no de la tienda: no hay forma de que una
        tienda opere en prueba y otra en producción sobre el mismo backend.
      `,
    },
    {
      heading: 'Correo no maneja cajas',
      body: `
        La API de Correo toma sólo el PRIMER elemento de la lista de bultos, así
        que cada pedido viaja como un único bulto consolidado.

        No hay nada que configurar acá al respecto, a diferencia de Andreani, que
        sí arma varias cajas por envío. Lo único que se declara es el bulto
        consolidado: su categoría de mercadería y, si el producto no trae medidas,
        las de reemplazo.
      `,
    },
    {
      heading: 'Productos sin medidas',
      body: `
        Por defecto, un producto sin peso o sin dimensiones ABORTA la cotización
        con un error que lista los ofensores. Es deliberado: inventar un bulto es
        cotizar mal.

        Las medidas de reemplazo son opt-in. Prendidas, esos productos cotizan
        igual con los valores cargados abajo. Si son más chicas que el bulto real,
        la diferencia la factura Correo después. Es una decisión comercial, no
        técnica.

        El coeficiente de aforo convierte volumen en peso facturable, así que
        tocarlo cambia lo que se le cobra al comprador. El valor por defecto es de
        comunidad: Correo no lo publica. Pedilo por escrito antes de moverlo.
      `,
    },
    {
      heading: 'El número de seguimiento propio',
      body: `
        Dejalo apagado hasta que Correo confirme POR ESCRITO el formato pactado.

        Lo que compra es idempotencia: un alta que hace timeout se reconoce como
        duplicada en vez de crear un segundo envío y pagar flete doble. Lo que
        arriesga es que un formato no pactado sea rechazado, y que una colisión
        dentro del acuerdo no tenga vuelta atrás.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        Los tres primeros pasos son los que deciden si la tienda cotiza. Los de
        origen son los que deciden si el alta del envío se acepta: paqar VALIDA la
        dirección de origen, y valida el código postal contra la provincia.
      `,
      steps: [
        'Cargar la API key de paqar. La planilla de Correo trae la celda con el prefijo "Apikey " ya puesto: pegala igual, el módulo lo saca.',
        'Cargar el número de acuerdo de ESTA tienda.',
        'Cargar usuario, contraseña y Customer ID de MiCorreo. Sin los tres no hay cotización.',
        'Completar la dirección de origen entera: código postal, calle, altura, localidad y provincia.',
        'Completar el remitente. El nombre por defecto no bloquea el alta, pero un envío real con ese nombre es un problema operativo.',
        'Con el modo de prueba prendido, usar el botón de probar conexión: pega contra Correo de verdad, autenticando en paqar y pidiendo una cotización de sonda en MiCorreo.',
        'Cotizar en el checkout y verificar que el precio no sea cero.',
        'Dar de alta un envío de prueba y confirmar que devuelve número de seguimiento.',
        'Recién ahí apagar el modo de prueba.',
      ],
    },
    {
      heading: 'Seguimiento',
      body: `
        La sincronización de tracking corre en un job programado. Su frecuencia se
        hornea al arrancar y no se puede reprogramar desde acá; lo que sí se
        configura es la ventana horaria, que lo restringe a las 8 a 21 hora
        argentina.

        La URL pública de seguimiento no es una API: es la página que se le manda
        al comprador. Si está mal, el síntoma es un link roto, no una falla de
        integración.
      `,
    },
  ],
});
