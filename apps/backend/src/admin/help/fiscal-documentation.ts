import { defineHelp } from './types';

export default defineHelp({
  title: 'Documentación Fiscal (ARCA)',
  summary:
    'Consulta en ARCA la constancia de inscripción de una empresa, la versiona con su historial y arma el PDF.',
  sections: [
    {
      heading: 'Qué hace hoy y qué no',
      body: `
        El módulo consulta el padrón: pide la constancia de inscripción de un CUIT,
        la guarda como versión y genera el PDF. Es LECTURA PURA, sin efectos ante
        el fisco.

        El servicio configurado es el único que este código sabe consumir.
        Apuntarlo a un servicio de facturación no habilita facturar: habilita
        FIRMAR con el certificado para algo que el código no implementa, y lo que
        se obtiene es un ticket que ninguna función sabe usar.

        El registro es polimórfico: la misma constancia sirve para una cuenta
        corporativa y para una empresa mayorista, y se ve como una pestaña dentro
        de cada una.
      `,
    },
    {
      heading: 'Homologación y producción se ven iguales desde el checkout',
      body: `
        Homologación es el entorno de PRUEBA de AFIP y producción es el real. El
        certificado de uno no sirve en el otro, y la diferencia no se nota en
        ninguna pantalla del storefront: aparece cuando ya es tarde.

        El valor por defecto es homologación, y eso es un cambio de comportamiento
        respecto del código viejo, donde la variable ausente caía en PRODUCCIÓN. Es
        deliberado: el default es lo que se usa cuando nadie dijo nada, y nadie
        dijo nada no puede significar apuntá al fisco de verdad.

        Una instalación que venía operando contra producción sin la variable tiene
        que dejarlo explícito, acá o en el entorno. Sin eso, la consulta de CUIT
        empieza a pegarle a homologación y falla: el checkout degrada a carga
        manual del dato, no se rompe.
      `,
    },
    {
      heading: 'Una cuenta de Minimalart para consultar CUITs',
      body: `
        El certificado, la clave privada y el CUIT titular pertenecen a Minimalart.
        Se administran en Integraciones → Todas → ARCA / AFIP y se usan para
        consultar el padrón desde todas las tiendas y empresas.

        El CUIT buscado es el dato de la consulta. No necesita credenciales propias
        ni modifica la cuenta que autentica el servicio.
      `,
    },
    {
      heading: 'Configurar o recuperar la conexión global',
      body: `
        Guardá juntos el CUIT de Minimalart, su certificado y la clave privada.
        Si no se pueden descifrar, revisá la clave de cifrado del backend o volvé
        a cargar la cuenta en Integraciones → Todas. Los registros antiguos
        de credenciales por empresa ya no se usan para las consultas.
      `,
    },
    {
      heading: 'El certificado se carga en base64, no como ruta',
      body: `
        Las variables de ruta a archivo sobreviven sólo como compatibilidad de
        instalaciones vivas, y se consultan únicamente si ninguna capa aportó el
        certificado en base64.

        Una ruta no se puede gestionar desde el admin: el valor guardado sería un
        nombre de archivo que hay que resolver en el filesystem del contenedor que
        lo lee, y en un droplet ese filesystem se rehace en cada deploy. Peor con
        varias tiendas: dos certificados distintos son dos archivos que alguien
        tiene que subir a mano a cada réplica.

        El base64 viaja con el dato. Se acepta tanto el base64 como el PEM pegado
        crudo, y una vez guardado nunca se vuelve a mostrar: sólo se reemplaza o se
        borra.
      `,
    },
    {
      heading: 'Cómo se versiona',
      body: `
        Cada consulta guarda un snapshot completo de lo que ARCA respondió. Hay una
        sola versión vigente por empresa; las anteriores se archivan como
        históricas y NUNCA se reemplazan.

        El diff compara DATOS, no momentos: el hash del contenido excluye la fecha
        de verificación, así que dos consultas idénticas hechas en días distintos
        no aparecen como un cambio. Lo que se marca es una razón social que cambió,
        una condición de IVA distinta, un domicilio nuevo.

        Con el PDF automático prendido, cada versión genera y sube su archivo al
        crearse. Y con el tope de versiones cargado, las más viejas se dan de baja
        lógica cuando se pasa el límite.
      `,
    },
  ],
});
