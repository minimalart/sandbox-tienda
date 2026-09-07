import { defineHelp } from './types';

/**
 * MercadoPago es la única extensión de esta tanda SIN pantalla de admin: se
 * administra desde el buscador central de ajustes, y la decisión de no crearle
 * una está tomada. Eso hace que el drawer sea todavía más necesario — no hay
 * ninguna otra superficie donde escribir el modelo.
 *
 * El encabezado de `descriptors/mercadopago.ts` tiene los tres bloqueos apilados
 * que explican por qué ninguna de las seis variables baja a la base, y el `reason`
 * de la public key tiene el gotcha real: separar el token de su public key
 * permite el estado imposible "public key de una cuenta, token de otra", que
 * cobra pero no renderiza. Eso es del modelo de la extensión, no de un campo.
 */
export default defineHelp({
  title: 'MercadoPago',
  summary: 'Cobra con MercadoPago por Checkout Express y por Checkout API, con toda su configuración en el entorno del backend.',
  sections: [
    {
      heading: 'Esta extensión no tiene pantalla propia',
      body: `
        Se administra desde el buscador central de ajustes. No es un olvido: las
        seis variables son de sólo lectura, y una pantalla dedicada a mostrar seis
        campos que no se pueden editar sería una entrada más en el menú lateral
        que no deja hacer nada.

        Lo que sí gana la extensión con estar declarada es aparecer en ese
        buscador con la razón de cada variable escrita al lado, en vez de ser
        invisible.
      `,
    },
    {
      heading: 'Son dos providers, no uno',
      body: `
        Checkout Express y Checkout API son dos providers de pago distintos que
        COMPARTEN las mismas credenciales. Los dos pueden estar prendidos a la
        vez; qué checkout ofrece cada tienda se elige en la configuración de esa
        tienda, no acá.

        Que compartan credenciales es lo que hace peligroso migrar uno solo a otra
        forma de configuración: dejaría medio checkout cobrando en la cuenta
        equivocada.
      `,
    },
    {
      heading: 'Por qué nada de esto se edita desde el admin',
      body: `
        Se apilan tres bloqueos independientes, y con uno solo ya alcanzaba.

        El primero es el gate de registración: la configuración de Medusa decide
        si los providers existen mirando estas variables, y eso pasa antes de que
        haya base de datos.

        El segundo es el contenedor: un provider de pago corre en un contenedor
        aislado, sin acceso al resto de los módulos. Desde ahí no se puede leer
        una fila de ajustes ni queriendo.

        El tercero es el camino del cobro: la cuenta se resuelve con una función
        SÍNCRONA, en medio del pago. Una lectura a la base ahí no es una mejora,
        es una latencia nueva en el peor lugar posible.
      `,
    },
    {
      heading: 'El token, la public key y el secreto del webhook van juntos',
      body: `
        Los tres son de la MISMA aplicación de MercadoPago y hay que moverlos
        juntos. Separarlos permite un estado imposible que no da error: public key
        de una cuenta y token de otra. El backend cobra contra una cuenta y el
        navegador renderiza el brick de la otra.

        Sin el secreto del webhook la verificación de firma no se hace: el webhook
        loguea y deja pasar. Es lo único que evita que cualquiera confirme un pago
        que nadie hizo.
      `,
    },
    {
      heading: 'Prender o apagar un provider no alcanza',
      body: `
        Después de cambiar el interruptor de cualquiera de los dos providers hay
        que correr el script de setup de MercadoPago para relinkear las regiones.

        Sin ese paso el provider existe pero ninguna región lo ofrece, así que en
        el checkout no aparece. El síntoma se lee como "la variable no tomó" y no
        es eso.
      `,
    },
    {
      heading: 'Varias cuentas por sucursal o canal',
      body: `
        La separación por punto de venta NO se hace con una credencial por tienda:
        se hace con el mapa de cuentas, un JSON que asocia cada sucursal o canal
        con su cuenta de MercadoPago dentro del mismo entorno.

        Ese mapa lo resuelve la misma función síncrona del camino del cobro, así
        que buscarlo en la configuración por tienda es buscar algo que no existe.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        Todo pasa por el entorno del backend: acá no se carga nada. El último paso
        es el que más se olvida.
      `,
      steps: [
        'En el panel de MercadoPago, crear la aplicación y copiar de ahí el access token y la public key. Tienen que ser de la misma aplicación.',
        'Generar el secreto del webhook en esa misma aplicación y configurarle la URL de webhooks de este backend.',
        'Cargar las tres en el entorno del backend, junto con el interruptor del provider que se vaya a usar.',
        'Si hay varias cuentas por sucursal o canal, cargar además el mapa de cuentas.',
        'Reiniciar el backend.',
        'Correr el script de setup de MercadoPago para relinkear las regiones. Sin esto el provider no aparece en el checkout.',
        'Hacer una compra de prueba y verificar que el webhook confirme la orden.',
      ],
    },
  ],
});
