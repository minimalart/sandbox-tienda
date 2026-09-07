/**
 * Política de privacidad — la versión HARDCODEADA, tal como se venía publicando.
 *
 * FALLBACK, no la fuente: la página real lee el texto del backoffice
 * (`lib/data/legal-pages.ts`). Esto se renderiza sólo cuando el backend no contesta —
 * un release escalonado donde el storefront ya tiene la ruta y el backend todavía no,
 * el backend caído, o la publishable key mal configurada. Servir el texto de siempre
 * es preferible a publicar una página legal en blanco.
 *
 * Se puede BORRAR cuando el backend con `GET /store/store-config/legal-pages` esté
 * desplegado en todos los proyectos, igual que el fallback de rutas de
 * `lib/site-config/active-tenant.ts`. Hasta entonces, el texto por defecto de verdad
 * es el de `apps/backend/src/modules/store-config/legal/defaults.ts`: si hay que
 * corregir el copy, se corrige ALLÁ.
 */
import LegalCard from '../legalCard'

export default function HardcodedPrivacyPolicy() {
  return (
    <section className='border-[#B5B5B5] border-b-[0.5px] border-gray-900/10 px-4 py-8 pb-20 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <h1 className='mb-6 font-bold text-[#18324A] text-3xl sm:text-4xl'>
          Política de privacidad
        </h1>

        <div className='grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]'>
          <LegalCard title='Información general' className='h-full'>
            <p>
              Para poder utilizar este Sitio Web de manera eficiente y segura,
              los usuarios deberán aportar ciertos datos, entre ellos, su nombre
              y apellido, domicilio, cuenta de e-mail, sin los cuales se
              tornaría imposible brindar los servicios. Por eso se requiere que
              éstos sean verdaderos y exactos. La información personal que los
              Usuarios ingresan en este Sitio Web es totalmente confidencial y
              La Empresa S.A. hará su mejor esfuerzo para proteger la
              privacidad de los mismos, de conformidad con lo dispuesto en la
              Ley 25.326. No obstante, lo anterior, el Usuario deberá tener en
              cuenta que Internet no es un medio inexpugnable en cuanto a su
              seguridad. Los Usuarios tienen el derecho de acceder a la
              información de su Cuenta, y podrán modificar los datos ingresados
              cuando lo deseen.
            </p>

            <p>
              Los Usuarios también podrán ejercer el derecho de rectificación,
              cuando los datos que se posean fueran incorrectos. Asimismo, los
              Usuarios podrán requerir en cualquier momento la baja de su
              solicitud y la eliminación de su Cuenta de la base de datos. En
              caso de que los datos sean requeridos por la vía legal,
              administrativa o judicial correspondiente, La Empresa S.A.
              se verá compelida a revelar los mismos a la autoridad solicitante.
              En la medida en que la legislación y normas de procedimiento lo
              permitan, La Empresa S.A. informará a los Usuarios sobre
              estos requerimientos.
            </p>

            <p>
              Por el sólo hecho de registrarse en este Sitio Web, los Usuarios
              aceptan que La Empresa S.A. tiene derecho a comunicarse
              con ellos por vía postal, telefónica o electrónica y enviar
              información que La Empresa S.A. considere, a su exclusivo
              criterio, que pueda ser de su interés, incluyendo publicidad e
              información sobre ofertas y promociones. En caso de que los
              Usuarios no deseen ser contactados con estos fines, podrán
              manifestárselo fehacientemente La Empresa S.A., quien
              procederá a interrumpir este tipo de comunicaciones en el menor
              tiempo que le sea posible.
            </p>
          </LegalCard>

          <div className='flex flex-col gap-5'>
            <LegalCard title='Información técnica'>
              <p>
                Si usted accede al Sitio Web de La Empresa S.A. a través
                de un dispositivo móvil como un teléfono inteligente, la
                información recogida también incluirá, cuando esté permitido, el
                identificador único de dispositivo de su teléfono,
                identificación de publicidad, ubicación geográfica y otros datos
                de dispositivos móviles similares.
              </p>
            </LegalCard>

            <LegalCard title='Seguimiento'>
              <p>
                Mientras usted navegue e interactúe con nuestro Sitio Web,
                usamos tecnologías de recogida de datos automáticas para tomar
                determinada información sobre sus acciones. Esto incluye
                información como los vínculos en los que hace clic, las páginas
                o contenidos que usted visualiza y durante cuánto tiempo y otra
                información y estadísticas similares sobre sus interacciones,
                como los tiempos de respuesta del contenido, errores de descarga
                y duración de las visitas a determinadas páginas.
              </p>

              <p>
                Esta información se captura utilizando tecnologías automatizadas
                como cookies (cookies de navegador, flash cookies) y balizas web
                y también se recoge mediante el uso de servicios de seguimiento
                de terceros (como Double Click, Google Analytics, Adobe Dynamic
                Tag Management y/o Omniture). Usted tiene el derecho de oponerse
                al uso de dichas tecnologías.
              </p>
            </LegalCard>
          </div>
        </div>
      </div>
    </section>
  )
}
