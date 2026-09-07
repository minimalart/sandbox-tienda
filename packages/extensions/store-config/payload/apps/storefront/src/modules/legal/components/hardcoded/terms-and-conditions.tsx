/**
 * Términos y condiciones — la versión HARDCODEADA, tal como se venía publicando.
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

import LegalCard from "../legalCard";

export default function HardcodedTermsAndConditions() {
  return (
    <section className="border-[#B5B5B5] border-b-[0.5px] border-gray-900/10 px-4 py-8 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <h1 className="font-bold text-[#18324A] text-3xl sm:text-4xl">
          Términos y condiciones
        </h1>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <LegalCard
            title="Aceptación y modificación de las condiciones de uso"
            className="xl:col-span-2"
          >
            <p>
              1. El acceso y uso de este Sitio Web (
              <a
                href="https://www.ejemplo.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                www.ejemplo.com.ar
              </a>
              ) de La Empresa se rige por las presentes condiciones de uso (las
              “Condiciones de uso”). Al acceder, navegar y utilizar nuestro
              Sitio Web usted reconoce que ha leído, entendido y aceptado, sin
              reservas, estas Condiciones de Uso, con las modificaciones que
              podamos realizar en el futuro.
            </p>

            <p>
              2. Si hubiese alguna modificación en nuestras Condiciones de Uso,
              publicaremos una nueva versión en nuestro Sitio Web. Por lo tanto,
              le sugerimos consultar estas Condiciones de Uso con regularidad a
              los efectos de mantenerse actualizado al respecto.
            </p>
          </LegalCard>

          <LegalCard title="Derecho de autor y propiedad intelectual">
            <p>
              El contenido del Sitio Web, así como los textos, marcas, logos,
              fotografías, videos, música, diseños y productos son de uso
              exclusivo de La Empresa bajo la autorización de la empresa
              propietaria de estos derechos, y en consecuencia están protegidos
              por derechos de autor, marcas, patentes y otros derechos de
              propiedad intelectual o industrial existentes bajo la legislación
              aplicable.
            </p>
          </LegalCard>

          <LegalCard title="El uso del sitio web">
            <p>
              1. Usted puede descargar, visualizar o imprimir el contenido de
              nuestro Sitio Web exclusivamente para uso personal y no comercial.
              Cualquier otro uso, incluyendo la reproducción, modificación,
              transmisión o difusión del contenido del Sitio Web, en todo o en
              parte y por cualquier medio, está estrictamente prohibido, salvo
              que medie consentimiento previo por escrito de La Empresa.
            </p>

            <p>
              2. Salvo lo dispuesto en estas Condiciones de Uso, nada de lo
              contenido en nuestro Sitio Web se entenderá o interpretará como
              una concesión a usted de una licencia o un derecho de uso de
              dichos contenidos de nuestro Sitio Web.
            </p>
          </LegalCard>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <LegalCard title="Información considerada no confidencial">
            <p>
              1. Los datos e información de identificación personal que usted
              proporcione a través de nuestro Sitio Web están protegidos y
              tratados de acuerdo a nuestra Política de Privacidad. La Empresa
              le invita a leer atentamente dichas Políticas de Privacidad antes
              de proveernos con tales datos e información de identificación
              personal.
            </p>

            <p>
              2. Cualquier otra información o material remitido a La Empresa a
              través de Internet, por correo electrónico o de otra manera,
              incluyendo datos, preguntas, comentarios, sugerencias, ideas,
              gráficos o similares, será tratado como no confidencial. Cualquier
              cosa que usted publique se convierte en propiedad de La Empresa, y
              puede ser utilizada libremente para cualquier propósito, incluyendo
              la divulgación, transmisión, publicación y envío por correo. En
              concreto, La Empresa es libre de usar cualquier idea, concepto o
              técnica contenida en cualquier comunicación que envíe al Sitio Web
              para cualquier propósito, incluyendo desarrollo, publicidad y
              marketing de productos utilizando dicha información. Cualquiera de
              estos usos no generará ninguna compensación a quienes proporcionan
              la información, ni a terceros.
            </p>

            <p>
              3. Al enviar la información, usted garantiza que es el propietario
              del material / contenido presentado, que no es difamatorio, y que
              el uso de La Empresa no violará los derechos de ningún tercero. La
              Empresa no tiene ninguna obligación de utilizar la información
              proporcionada.
            </p>
          </LegalCard>

          <LegalCard title="Renuncia de garantías">
            <p>
              1. Cualquier material, información y todo lo que usted encuentre en
              el Sitio Web son proporcionados a usted “tal cual”, en función de
              su disponibilidad y sin garantía de ningún tipo, expresa o
              implícita, incluyendo, entre otros, la garantía implícita de
              comerciabilidad o idoneidad para un determinado fin.
            </p>

            <p>
              2. La Empresa no garantiza que sus sitios web o su contenido
              corresponderán a sus expectativas, ni que serán ininterrumpidos,
              puntuales, seguros y libres de errores.
            </p>

            <p>
              3. Todo asesoramiento o información, ya sea oral o escrito,
              obtenido de La Empresa durante el uso de los servicios disponibles
              en el Sitio Web, no dará lugar a ninguna garantía que no esté
              expresamente prevista en las presentes Condiciones de Uso.
            </p>
          </LegalCard>

          <LegalCard title="Limitación de responsabilidad">
            <p>
              1. El acceso, uso y navegación en nuestro Sitio Web es bajo su
              estricta responsabilidad.
            </p>

            <p>
              2. Usted reconoce y acepta que, de acuerdo a la normativa vigente,
              ni La Empresa y cualquiera de sus empresas afiliadas, ni ninguna
              otra parte involucrada en la creación, producción o entrega del
              Sitio Web pueden considerarse responsables de los daños directos,
              indirectos o consecuentes, de cualquier daño a los costos,
              pérdidas, modificación de ingresos o ganancias, perjuicios o
              reputación de cualquier naturaleza (incluso si el evento de tal
              daño fuera conocido o podría haber sido conocido por La Empresa),
              que puedan derivar de su acceso al uso o la imposibilidad del uso
              del Sitio Web y sus contenidos.
            </p>

            <p>
              3. Todos los materiales que se descargan u obtienen en el uso de
              nuestro Sitio Web están bajo su propio riesgo. La Empresa no asume
              ninguna responsabilidad por cualquier daño o virus que puedan
              afectar a su computadora u otra propiedad por razón de su acceso,
              uso o descarga de material de su Sitio Web o por cualquier
              intrusión ilegal o intervención en los sistemas informáticos.
            </p>

            <p>
              4. La Empresa se reserva el derecho de interrumpir o suspender
              total o parcialmente la funcionalidad de su Sitio Web. La Empresa
              no asume responsabilidad alguna por cualquier interrupción o
              suspensión de dicha funcionalidad.
            </p>
          </LegalCard>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <LegalCard title="Cambio de información">
            <p>
              La Empresa se reserva el derecho de hacer cambios, correcciones y
              / o mejoras al contenido de nuestro Sitio Web en cualquier momento
              sin previo aviso, sin asumir responsabilidad de hacerlo.
            </p>
          </LegalCard>

          <LegalCard title="Disponibilidad de productos / servicios">
            <p>
              No todos los productos o servicios ofrecidos en el Sitio Web
              deberán estar disponibles para su cotización o comercialización en
              todas las regiones o áreas geográficas.
            </p>
          </LegalCard>

          <LegalCard title="Enlaces" className="xl:col-span-2">
            <p>
              1. Como un servicio a nuestros visitantes, nuestro Sitio Web puede
              contener enlaces de hipertexto que conducen a otros sitios que no
              son operados o controlados por La Empresa. La Empresa no será
              considerada responsable de estos sitios y declina toda
              responsabilidad en relación con su contenido, legalidad, exactitud
              o funciones.
            </p>

            <p>
              2. La creación de cualquier hipervínculo a nuestro Sitio Web está
              prohibida sin el previo consentimiento por escrito de La Empresa.
            </p>
          </LegalCard>

          <LegalCard title="Otros" className="xl:col-span-2">
            <p>
              1. Las presentes condiciones de uso enmarcan la totalidad del
              acuerdo celebrado entre La Empresa y usted como usuario sobre el
              acceso y el uso del Sitio Web y su contenido. Todos los otros
              términos y condiciones emitidos por La Empresa, que rijan la
              relación con usted, en particular con cualquier servicio o compra
              de productos, serán complementarios a las Condiciones de Uso.
            </p>

            <p>
              2. El hecho de que La Empresa tolere una violación por parte de
              usted de una de las obligaciones establecidas en las Condiciones
              de Uso, o no desee hacer valer un derecho que se le atribuye en
              virtud del mismo o en virtud de la ley, no se interpretará como
              una renuncia por parte de La Empresa a invocar y aplicar sus
              derechos.
            </p>

            <p>
              3. En caso de que alguna cláusula de las Condiciones de Uso,
              existente o futura, sea considerada ilegal por la ley o las
              regulaciones aplicables o por decisión judicial, tal disposición
              será considerada como afectada, manteniéndose todas las demás
              disposiciones de las Condiciones de Uso en pleno vigor y efecto
              entre usted y La Empresa.
            </p>

            <p>
              4. Los títulos de los artículos de las Condiciones de Uso son
              puramente indicativos y no deberán alterar o modificar de ninguna
              manera los términos y condiciones.
            </p>
          </LegalCard>

          <LegalCard
            title="Aceptación de los términos de uso"
            className="xl:col-span-2"
          >
            <p>
              1. Los presentes términos de uso regulan las relaciones entre La
              Empresa y los usuarios de los servicios brindados a través de este
              Sitio Web y están sujetos a las presentes condiciones.
            </p>

            <p>
              2. Si el usuario se registra y pulsa el ícono “Registrarme”,
              significará que dicho usuario reconoce que ha leído, entendido y
              aceptado los presentes términos y condiciones y que cumplirá con
              ellos.
            </p>

            <p>
              3. En el caso de que no se cumplan los términos de uso, La Empresa
              se reserva el derecho, sin indemnización alguna y sin previo aviso,
              de suspender y/o denegar el acceso en el futuro a todos o parte de
              los servicios disponibles en este Sitio Web, sin perjuicio de las
              diferentes causas de procesos judiciales o contractuales que
              pudiera demandar.
            </p>
          </LegalCard>

          <LegalCard title="Registro" className="xl:col-span-2">
            <p>
              1. A fin de hacer uso de los servicios de venta ofrecidos en el
              Sitio Web el usuario deberá registrarse informando sus datos
              personales. En caso que decida registrarse, se informa que el
              mismo implica la aceptación de los presentes términos de uso.
            </p>

            <p>
              2. El usuario tiene la obligación de proporcionar información
              precisa, completa y actualizada.
            </p>

            <p>
              3. La clave de acceso es estrictamente personal e intransferible.
              El usuario tiene la obligación de no divulgar su contraseña a
              terceros. De conformidad con los presentes términos de uso y la
              ley, el usuario es responsable de las posibles acciones realizadas
              por cualquier persona que utilice su contraseña, incluso si el
              usuario en cuestión no tiene conocimiento de ello. El usuario tiene
              la obligación de denunciar a La Empresa cualquier uso no autorizado
              de su contraseña tan pronto como sea posible.
            </p>
          </LegalCard>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <LegalCard title="Precios">
            <p>
              1. Los precios a pagar por los productos que usted solicite son
              aquellos publicados por La Empresa en este Sitio Web, a la fecha en
              que se formaliza el pedido. Los precios incluyen IVA.
            </p>

            <p>
              2. Los cargos de envío serán sin cargo en base a los montos
              mínimos de compra indicados en este Sitio Web, pudiendo La Empresa
              modificar los mismos en cualquier momento.
            </p>

            <p>
              3. Los pagos de los productos podrán realizarse únicamente a través
              de este Sitio Web y por los medios de pago indicados y aceptados en
              el checkout.
            </p>
          </LegalCard>

          <LegalCard title="Entrega">
            <p>
              1. Todos los pedidos confirmados por La Empresa serán enviados a la
              dirección de entrega que usted especificó al realizar su pedido. En
              caso de no poder efectuarse la entrega con éxito, el pedido será
              reingresado y será el cliente el encargado de comunicarse a fin de
              pactar una nueva entrega.
            </p>

            <p>
              2. La Empresa hace su mayor esfuerzo para asegurar las entregas
              dentro de los días que se le informan al usuario al momento de
              confirmar la recepción del pedido.
            </p>
          </LegalCard>

          <LegalCard
            title="Verificación de mercancía"
            className="xl:col-span-2"
          >
            <p>
              1. Es su responsabilidad verificar la cantidad y la condición de la
              mercancía al momento de la entrega.
            </p>

            <p>
              2. En caso de que usted note algún daño en el producto o que la
              mercancía esté incompleta, debe notificar directamente a La Empresa
              a través de los canales de atención al cliente dentro de las 48 hs
              hábiles de producida la entrega.
            </p>
          </LegalCard>

          <LegalCard
            title="Cambios y devoluciones"
            className="xl:col-span-2"
            sectionId="changes-and-returns"
          >
            <p>
              1. Para cambios y/o devoluciones de productos el usuario deberá
              enviar su consulta dentro de los 10 días posteriores a la fecha de
              recepción de la compra indicando el motivo por el cual solicita el
              cambio y/o devolución. Solo se aceptarán cambios en la condición y
              empaque original del producto, acompañados por una factura de
              compra, siempre que la misma haya sido realizada por este Sitio
              Web.
            </p>

            <p>
              2. En caso de que el usuario solicite la devolución del producto,
              La Empresa procederá a retirarlo por la misma vía en que se hizo
              entrega. Una vez que La Empresa reciba el producto y verifique que
              el mismo se encuentre en condiciones de ser cambiado, le reenviará
              al usuario un nuevo producto respetando las condiciones de entrega
              estipuladas en estos términos de uso.
            </p>
          </LegalCard>
        </div>

        <div className="flex flex-col gap-5">
          <LegalCard title="Limitación de las responsabilidades">
            <p>
              1. Las fotografías y textos que ilustran y describen los productos
              en este Sitio Web no son contractuales y su único propósito es el
              de informar. La Empresa no será responsable en caso de errores u
              omisiones en las fotografías o textos mostrados en este Sitio Web.
            </p>

            <p>
              2. En ningún caso La Empresa será responsable por cualquier daño
              directo, indirecto o subsecuente de ningún tipo, que pueda surgir
              en conexión con sus productos, su uso, venta o este Sitio Web.
            </p>
          </LegalCard>

          <LegalCard title="Fuerza Mayor">
            <p>
              La Empresa hará todo esfuerzo razonable para cumplir sus
              obligaciones. Sin embargo, La Empresa no puede hacerse responsable
              por retrasos o fallas en la entrega causadas por circunstancias más
              allá de su control razonable. Tales circunstancias incluyen
              huelgas, guerras, catástrofes naturales o cualquier otra situación
              que pueda impedir la producción, transportación o entrega de los
              productos.
            </p>
          </LegalCard>

          <LegalCard title="Modificación de los servicios">
            <p>
              La Empresa se reserva el derecho, sin indemnización alguna, sin
              previo aviso y en cualquier momento, a modificar o cancelar,
              temporal o permanentemente, todos o parte de los servicios
              disponibles en el presente Sitio Web. El usuario reconoce que La
              Empresa puede no responsabilizarse de ningún posible daño
              ocasionado como consecuencia de una modificación o cancelación de
              los servicios.
            </p>
          </LegalCard>

          <LegalCard title="Defensa del Consumidor">
            <p>
              La Empresa reconoce los derechos de información de los
              consumidores, por lo cual pone a su disposición un contacto
              electrónico gratuito a través de tienda@ejemplo.com.ar y los
              canales de atención al cliente informados en el Sitio Web.
            </p>

            <p>
              Para conocer sus derechos y obligaciones, los consumidores pueden
              consultar la Ley de Defensa del Consumidor Nº 24.240 o dirigirse al
              sitio de la Secretaría de Comercio Interior.
            </p>
          </LegalCard>

          <LegalCard title="Disposiciones varias">
            <p>
              1. La Empresa se reserva el derecho de modificar y/o actualizar los
              presentes términos de uso sin que ello requiera aviso o requisito
              alguno. El usuario tiene la obligación de consultar el Sitio Web
              para conocer las modificaciones y/o actualizaciones realizadas.
            </p>

            <p>
              2. La factura de compra será enviada en forma electrónica al correo
              electrónico registrado, conforme a la normativa fiscal vigente.
            </p>

            <p>
              3. Los títulos de las secciones de los presentes términos de uso se
              utilizan por razones de conveniencia y no deberán alterar o
              modificar los términos de ninguna forma.
            </p>

            <p>
              4. Los presentes Términos de uso serán interpretados conforme a las
              leyes de la República Argentina.
            </p>

            <p>
              5. Cualquier controversia que surja de o en relación con el uso del
              Sitio será resuelta en los tribunales ordinarios competentes,
              siendo de aplicación el derecho argentino.
            </p>
          </LegalCard>
        </div>
      </div>
    </section>
  );
}
