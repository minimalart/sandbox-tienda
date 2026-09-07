import { defineHelp } from './types';

/**
 * B2B tiene UN solo ajuste editable y toda su ayuda apilada alrededor: la
 * `description` de `routes/companies/settings/page.tsx` repite en tres oraciones
 * lo mismo que el `help` de `B2B_SALES_CHANNEL_ID` (que tiene 380 caracteres) y
 * lo mismo que el comentario de cabecera de `descriptors/b2b.ts`. Las tres dicen
 * la misma cosa porque es de la EXTENSIÓN, no del campo: el canal mayorista es
 * lo que decide a qué TIENDA pertenece cada empresa.
 *
 * El resto del modelo mental —roles, cuenta corriente, el customer group como
 * único portador de los precios— no está escrito en ninguna pantalla: vive en
 * `modules/company/types.ts` y `modules/company-credit/types.ts`.
 */
export default defineHelp({
  title: 'B2B',
  summary:
    'Empresas que compran al por mayor, con sus usuarios, su cuenta corriente y su canal de ventas propio.',
  sections: [
    {
      heading: 'El canal mayorista es lo que define la tienda',
      body: `
        A cada empresa nueva se le estampa el canal de ventas mayorista
        configurado en esta pantalla. No es cosmético: esa columna es lo que
        decide a qué tienda pertenece la empresa, porque se cruza contra los
        canales de la tienda.

        Un canal equivocado no rompe nada visible. La empresa se crea igual, sin
        error, y queda colgada de la tienda que no es: sus pedidos cotizan con la
        lista de precios de otra. Es la falla más cara de esta extensión y sólo
        se descubre mirando precios.

        Por eso el ID se copia de Configuración y Canales de venta, donde la URL
        termina en el ID, y no se escribe a mano.
      `,
    },
    {
      heading: 'Cambiarlo no reasigna nada',
      body: `
        El canal se estampa AL CREAR la empresa. Cambiar el valor de esta
        pantalla sólo afecta a las empresas que se registren de acá en adelante:
        las que ya existen conservan el canal con el que nacieron.

        La configuración es por tienda: cada una tiene su propio canal mayorista.
        Si una tienda secundaria no cargó el suyo, la empresa se crea sin canal y
        hay que asignárselo después, que es exactamente lo que pasaba antes de
        que este ajuste existiera.
      `,
    },
    {
      heading: 'Las empresas viejas se ven en todas las tiendas',
      body: `
        Las empresas creadas antes de que existiera la columna de canal la tienen
        vacía, y una empresa sin canal aparece en el listado de TODAS las tiendas.

        Es deliberado: esconderlas sería una regresión visible el día del deploy.
        Cuando se les complete el canal, cada una va a aparecer sólo donde
        corresponde.
      `,
    },
    {
      heading: 'Los precios mayoristas los aplica el customer group',
      body: `
        La empresa no lleva precios. Lo que aplica la lista mayorista es el grupo
        de clientes vinculado, y son sus miembros los que compran con esa lista.

        Una empresa sin grupo de clientes vinculado está operativa pero sus
        usuarios compran a precio de lista general. No hay error, no hay aviso en
        el checkout: los números simplemente son los otros.
      `,
    },
    {
      heading: 'Quién puede hacer qué',
      body: `
        Los roles no son decorativos y se reparten en dos ejes que no coinciden.

        Gestionan la empresa, sus usuarios y sus invitaciones sólo el propietario
        y el administrador. Pueden comprar el propietario, el administrador y el
        comprador. El observador ve y no hace ninguna de las dos cosas.
      `,
    },
    {
      heading: 'La cuenta corriente',
      body: `
        Cada empresa puede tener UNA cuenta corriente: una línea de crédito
        administrada desde el backoffice. El crédito disponible no se guarda, se
        deriva: es el límite menos el saldo utilizado.

        El saldo utilizado NUNCA se edita a mano. Se mueve sólo por movimientos
        del libro: las compras lo aumentan y llegan solas desde la orden; pagos,
        notas de crédito, notas de débito y ajustes se cargan a mano.

        Sólo una cuenta en estado activo habilita el medio de pago. Suspendida o
        bloqueada, la empresa sigue existiendo y comprando por los otros medios.
      `,
    },
    {
      heading: 'La invitación se crea aunque el mail no salga',
      body: `
        El mail de invitación a una empresa se manda con una plantilla dinámica de
        SendGrid, configurada en Emails. Si ese identificador no existe en la
        cuenta, SendGrid rechaza el envío.

        La invitación se crea igual y queda pendiente en la lista: desde el admin
        parece que todo salió bien y la persona invitada no recibió nada.
      `,
    },
  ],
});
