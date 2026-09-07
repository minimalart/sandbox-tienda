import { defineHelp } from './types';

/**
 * Beneficios de pago tiene el texto explicativo repartido en tres lugares de la
 * misma pantalla: un párrafo hardcodeado arriba de la lista de proveedores, la
 * `description` de la card de ajustes, y el bloque de sólo-entorno que sale del
 * descriptor. Los tres dicen pedazos de la misma cosa.
 *
 * El gotcha que ninguno dice completo es el reparto: el sync trae SÓLO lo que la
 * API pública de MercadoPago expone —medios de pago y cuotas sin interés— y todo
 * lo demás (descuentos, reintegros, promos bancarias) se carga a mano. Quien
 * espere que el botón le traiga las promos del banco va a esperar para siempre,
 * sin ningún error de por medio.
 */
export default defineHelp({
  title: 'Beneficios de pago',
  summary: 'Catálogo de medios de pago y cuotas sin interés sincronizado de MercadoPago, más los beneficios cargados a mano.',
  sections: [
    {
      heading: 'Qué trae el sync y qué no',
      body: `
        El sync le pega a la API PÚBLICA de MercadoPago y trae dos cosas: el
        catálogo de medios de pago del comercio y el máximo de cuotas sin interés
        de cada uno.

        Todo lo demás se carga a mano en la pestaña Beneficios: descuentos,
        reintegros, promociones bancarias, topes, días de la semana. MercadoPago
        no los expone, así que no hay nada que sincronizar.

        Es la confusión más cara de esta extensión porque no falla: el sync
        termina bien, dice cuántos ítems trajo, y las promos del banco siguen sin
        aparecer. No es un error del sync; es que nunca estuvieron en su alcance.
      `,
    },
    {
      heading: 'El token no se configura acá',
      body: `
        El sync reutiliza el access token de MercadoPago del checkout. Esa
        credencial la posee la extensión MercadoPago, que es quien cobra con ella,
        y allá tampoco es editable desde el admin: es opción de arranque de los
        dos providers de pago y la resuelve una función síncrona que está en el
        camino del cobro.

        O sea que el token no baja a la base por ningún lado. Se configura en el
        entorno del backend, junto con el resto de las credenciales de
        MercadoPago.

        Sin ese token el botón de sincronizar no falla en silencio: devuelve un
        error que nombra la variable que falta.
      `,
    },
    {
      heading: 'El sync se dispara a mano',
      body: `
        No hay job programado: el catálogo se actualiza cuando alguien aprieta el
        botón. La línea de "última sincronización" dice cuándo fue la última y con
        qué resultado.

        Las métricas de arriba cuentan beneficios, no medios de pago: total,
        activos, próximos a vencer y errores de sincronización. El contador de
        errores en rojo es la señal de que la última corrida no terminó bien.
      `,
    },
    {
      heading: 'Beneficios sincronizados y beneficios manuales',
      body: `
        Un beneficio traído por el sync tiene sus datos oficiales de sólo lectura:
        no se pueden editar porque la próxima corrida los pisaría. Lo que sí se
        edita es la capa de decisión propia: visibilidad, prioridad, canales de
        venta y notas.

        Un beneficio cargado a mano es editable entero. Los dos conviven en la
        misma lista y en el mismo orden de prioridad.
      `,
    },
    {
      heading: 'Los beneficios se pueden acotar por tienda',
      body: `
        Cada beneficio declara a qué canales de venta aplica. Un beneficio sin
        canales declarados se ve en TODAS las tiendas, que es el default.

        En multitienda eso significa que el estado por descuido es "visible en
        todas": si una promo es de una sola tienda, hay que decirlo
        explícitamente.
      `,
    },
    {
      heading: 'Puesta en marcha',
      body: `
        El primer paso no se hace en esta pantalla, y es el único que puede
        bloquear todo lo demás.
      `,
      steps: [
        'Verificar que el access token de MercadoPago esté cargado en el entorno del backend. Es el mismo que usa el checkout.',
        'Apretar Sincronizar Mercado Pago y verificar que el catálogo de medios de pago se llene.',
        'Revisar el máximo de cuotas sin interés de cada medio contra lo que tiene pactado el comercio.',
        'Cargar a mano, en la pestaña Beneficios, los descuentos y promociones bancarias que el comercio tenga vigentes.',
        'Acotar por canal de venta los beneficios que sean de una sola tienda. Sin canales declarados se ven en todas.',
        'Revisar la lista de próximos a vencer cada tanto: un beneficio vencido deja de mostrarse sin avisar.',
      ],
    },
  ],
});
