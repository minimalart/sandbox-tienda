import sanitizeHtml from 'sanitize-html';
import {
  LEGAL_PAGE_SLUGS,
  type LegalPageDoc,
  type LegalPages,
  type LegalPageSlug,
  type LegalSection,
} from './pages';

/**
 * Los textos legales POR DEFECTO y su saneado.
 *
 * SERVER-ONLY: importa `sanitize-html`. Lo neutro (slugs, tipos, rutas) vive en
 * `pages.ts`, que es lo único que puede importar el admin.
 *
 * ─── POR QUÉ SE GUARDA HTML Y NO EL JSON DE TIPTAP ─────────────────────────
 *
 * El blog guarda el documento nativo de Tiptap y lo renderiza en el server con
 * `@tiptap/html`. Acá se guarda HTML saneado al ESCRIBIR, y por dos razones que
 * sólo valen para los legales:
 *
 *  1. Los defaults de abajo son el texto que estaba hardcodeado en las tres
 *     `page.tsx` del storefront — 840 líneas de JSX. Transcribirlo a nodos de
 *     Tiptap a mano es la clase de trabajo donde un `type: 'paragraph'` mal
 *     anidado no falla: renderiza de menos y nadie se entera.
 *  2. La lectura pública queda sin trabajo: `GET /store/store-config/legal-pages`
 *     devuelve la columna tal cual.
 *
 * El precio es que el HTML es el formato canónico: si algún día cambia el set de
 * marcas permitidas, lo guardado no se re-renderiza solo. Para texto legal —que se
 * edita dos veces al año— es el intercambio correcto.
 *
 * ─── DE DÓNDE SALEN LAS SECCIONES ──────────────────────────────────────────
 *
 * Del propio JSX que reemplazan: cada `<LegalCard title="…">` de las páginas viejas
 * ERA una sección con nombre, sólo que escrita a mano y sin poder reordenarse. Los
 * nombres de abajo son esos títulos, literales. Así el default no inventa una
 * estructura nueva: describe la que ya se estaba publicando.
 *
 * ─── POR QUÉ EL DEFAULT ES EL TEXTO DE EJEMPLO, TAL CUAL ───────────────────
 *
 * Porque cambiarlo sería una edición de contenido escondida en un PR de
 * infraestructura: hoy TODA tienda del boilerplate publica "La Empresa S.A." y
 * "www.ejemplo.com.ar" en sus legales, y este cambio no lo arregla — lo vuelve
 * ARREGLABLE. Lo que sí hace es decirlo: mientras una tienda no guarde sus secciones,
 * la card del backoffice avisa que está publicando el texto de ejemplo
 * (`customized: false`).
 *
 * `updated_label` arranca en `null` en las tres, y es deliberado: la fecha de última
 * actualización es una AFIRMACIÓN sobre el documento. Poner una acá haría que cada
 * tienda del boilerplate publique una fecha que nadie eligió, encima de un texto que
 * nadie escribió. Sin fecha, la página simplemente no la muestra.
 */

/** Helper para que los defaults se lean como el documento y no como un objeto. */
const section = (id: string, name: string, html: string): LegalSection => ({
  id,
  name,
  html: html.trim(),
});

/** Política de privacidad — las 3 `LegalCard` de `legal/legals/page.tsx`. */
const PRIVACY_SECTIONS: LegalSection[] = [
  section(
    'privacy-general',
    'Información general',
    `
<p>Para poder utilizar este Sitio Web de manera eficiente y segura, los usuarios deberán aportar ciertos datos, entre ellos, su nombre y apellido, domicilio, cuenta de e-mail, sin los cuales se tornaría imposible brindar los servicios. Por eso se requiere que éstos sean verdaderos y exactos. La información personal que los Usuarios ingresan en este Sitio Web es totalmente confidencial y La Empresa S.A. hará su mejor esfuerzo para proteger la privacidad de los mismos, de conformidad con lo dispuesto en la Ley 25.326. No obstante, lo anterior, el Usuario deberá tener en cuenta que Internet no es un medio inexpugnable en cuanto a su seguridad. Los Usuarios tienen el derecho de acceder a la información de su Cuenta, y podrán modificar los datos ingresados cuando lo deseen.</p>
<p>Los Usuarios también podrán ejercer el derecho de rectificación, cuando los datos que se posean fueran incorrectos. Asimismo, los Usuarios podrán requerir en cualquier momento la baja de su solicitud y la eliminación de su Cuenta de la base de datos. En caso de que los datos sean requeridos por la vía legal, administrativa o judicial correspondiente, La Empresa S.A. se verá compelida a revelar los mismos a la autoridad solicitante. En la medida en que la legislación y normas de procedimiento lo permitan, La Empresa S.A. informará a los Usuarios sobre estos requerimientos.</p>
<p>Por el sólo hecho de registrarse en este Sitio Web, los Usuarios aceptan que La Empresa S.A. tiene derecho a comunicarse con ellos por vía postal, telefónica o electrónica y enviar información que La Empresa S.A. considere, a su exclusivo criterio, que pueda ser de su interés, incluyendo publicidad e información sobre ofertas y promociones. En caso de que los Usuarios no deseen ser contactados con estos fines, podrán manifestárselo fehacientemente La Empresa S.A., quien procederá a interrumpir este tipo de comunicaciones en el menor tiempo que le sea posible.</p>
`,
  ),
  section(
    'privacy-technical',
    'Información técnica',
    `
<p>Si usted accede al Sitio Web de La Empresa S.A. a través de un dispositivo móvil como un teléfono inteligente, la información recogida también incluirá, cuando esté permitido, el identificador único de dispositivo de su teléfono, identificación de publicidad, ubicación geográfica y otros datos de dispositivos móviles similares.</p>
`,
  ),
  section(
    'privacy-tracking',
    'Seguimiento',
    `
<p>Mientras usted navegue e interactúe con nuestro Sitio Web, usamos tecnologías de recogida de datos automáticas para tomar determinada información sobre sus acciones. Esto incluye información como los vínculos en los que hace clic, las páginas o contenidos que usted visualiza y durante cuánto tiempo y otra información y estadísticas similares sobre sus interacciones, como los tiempos de respuesta del contenido, errores de descarga y duración de las visitas a determinadas páginas.</p>
<p>Esta información se captura utilizando tecnologías automatizadas como cookies (cookies de navegador, flash cookies) y balizas web y también se recoge mediante el uso de servicios de seguimiento de terceros (como Double Click, Google Analytics, Adobe Dynamic Tag Management y/o Omniture). Usted tiene el derecho de oponerse al uso de dichas tecnologías.</p>
`,
  ),
];

/** Términos y condiciones — las 21 `LegalCard` de `legal/conditions/page.tsx`. */
const CONDITIONS_SECTIONS: LegalSection[] = [
  section(
    'terms-acceptance',
    'Aceptación y modificación de las condiciones de uso',
    `
<p>1. El acceso y uso de este Sitio Web (<a href="https://www.ejemplo.com.ar" target="_blank" rel="noopener noreferrer">www.ejemplo.com.ar</a>) de La Empresa se rige por las presentes condiciones de uso (las “Condiciones de uso”). Al acceder, navegar y utilizar nuestro Sitio Web usted reconoce que ha leído, entendido y aceptado, sin reservas, estas Condiciones de Uso, con las modificaciones que podamos realizar en el futuro.</p>
<p>2. Si hubiese alguna modificación en nuestras Condiciones de Uso, publicaremos una nueva versión en nuestro Sitio Web. Por lo tanto, le sugerimos consultar estas Condiciones de Uso con regularidad a los efectos de mantenerse actualizado al respecto.</p>
`,
  ),
  section(
    'terms-copyright',
    'Derecho de autor y propiedad intelectual',
    `
<p>El contenido del Sitio Web, así como los textos, marcas, logos, fotografías, videos, música, diseños y productos son de uso exclusivo de La Empresa bajo la autorización de la empresa propietaria de estos derechos, y en consecuencia están protegidos por derechos de autor, marcas, patentes y otros derechos de propiedad intelectual o industrial existentes bajo la legislación aplicable.</p>
`,
  ),
  section(
    'terms-site-use',
    'El uso del sitio web',
    `
<p>1. Usted puede descargar, visualizar o imprimir el contenido de nuestro Sitio Web exclusivamente para uso personal y no comercial. Cualquier otro uso, incluyendo la reproducción, modificación, transmisión o difusión del contenido del Sitio Web, en todo o en parte y por cualquier medio, está estrictamente prohibido, salvo que medie consentimiento previo por escrito de La Empresa.</p>
<p>2. Salvo lo dispuesto en estas Condiciones de Uso, nada de lo contenido en nuestro Sitio Web se entenderá o interpretará como una concesión a usted de una licencia o un derecho de uso de dichos contenidos de nuestro Sitio Web.</p>
`,
  ),
  section(
    'terms-non-confidential',
    'Información considerada no confidencial',
    `
<p>1. Los datos e información de identificación personal que usted proporcione a través de nuestro Sitio Web están protegidos y tratados de acuerdo a nuestra Política de Privacidad. La Empresa le invita a leer atentamente dichas Políticas de Privacidad antes de proveernos con tales datos e información de identificación personal.</p>
<p>2. Cualquier otra información o material remitido a La Empresa a través de Internet, por correo electrónico o de otra manera, incluyendo datos, preguntas, comentarios, sugerencias, ideas, gráficos o similares, será tratado como no confidencial. Cualquier cosa que usted publique se convierte en propiedad de La Empresa, y puede ser utilizada libremente para cualquier propósito, incluyendo la divulgación, transmisión, publicación y envío por correo. En concreto, La Empresa es libre de usar cualquier idea, concepto o técnica contenida en cualquier comunicación que envíe al Sitio Web para cualquier propósito, incluyendo desarrollo, publicidad y marketing de productos utilizando dicha información. Cualquiera de estos usos no generará ninguna compensación a quienes proporcionan la información, ni a terceros.</p>
<p>3. Al enviar la información, usted garantiza que es el propietario del material / contenido presentado, que no es difamatorio, y que el uso de La Empresa no violará los derechos de ningún tercero. La Empresa no tiene ninguna obligación de utilizar la información proporcionada.</p>
`,
  ),
  section(
    'terms-warranty-disclaimer',
    'Renuncia de garantías',
    `
<p>1. Cualquier material, información y todo lo que usted encuentre en el Sitio Web son proporcionados a usted “tal cual”, en función de su disponibilidad y sin garantía de ningún tipo, expresa o implícita, incluyendo, entre otros, la garantía implícita de comerciabilidad o idoneidad para un determinado fin.</p>
<p>2. La Empresa no garantiza que sus sitios web o su contenido corresponderán a sus expectativas, ni que serán ininterrumpidos, puntuales, seguros y libres de errores.</p>
<p>3. Todo asesoramiento o información, ya sea oral o escrito, obtenido de La Empresa durante el uso de los servicios disponibles en el Sitio Web, no dará lugar a ninguna garantía que no esté expresamente prevista en las presentes Condiciones de Uso.</p>
`,
  ),
  section(
    'terms-liability',
    'Limitación de responsabilidad',
    `
<p>1. El acceso, uso y navegación en nuestro Sitio Web es bajo su estricta responsabilidad.</p>
<p>2. Usted reconoce y acepta que, de acuerdo a la normativa vigente, ni La Empresa y cualquiera de sus empresas afiliadas, ni ninguna otra parte involucrada en la creación, producción o entrega del Sitio Web pueden considerarse responsables de los daños directos, indirectos o consecuentes, de cualquier daño a los costos, pérdidas, modificación de ingresos o ganancias, perjuicios o reputación de cualquier naturaleza (incluso si el evento de tal daño fuera conocido o podría haber sido conocido por La Empresa), que puedan derivar de su acceso al uso o la imposibilidad del uso del Sitio Web y sus contenidos.</p>
<p>3. Todos los materiales que se descargan u obtienen en el uso de nuestro Sitio Web están bajo su propio riesgo. La Empresa no asume ninguna responsabilidad por cualquier daño o virus que puedan afectar a su computadora u otra propiedad por razón de su acceso, uso o descarga de material de su Sitio Web o por cualquier intrusión ilegal o intervención en los sistemas informáticos.</p>
<p>4. La Empresa se reserva el derecho de interrumpir o suspender total o parcialmente la funcionalidad de su Sitio Web. La Empresa no asume responsabilidad alguna por cualquier interrupción o suspensión de dicha funcionalidad.</p>
`,
  ),
  section(
    'terms-info-changes',
    'Cambio de información',
    `
<p>La Empresa se reserva el derecho de hacer cambios, correcciones y / o mejoras al contenido de nuestro Sitio Web en cualquier momento sin previo aviso, sin asumir responsabilidad de hacerlo.</p>
`,
  ),
  section(
    'terms-availability',
    'Disponibilidad de productos / servicios',
    `
<p>No todos los productos o servicios ofrecidos en el Sitio Web deberán estar disponibles para su cotización o comercialización en todas las regiones o áreas geográficas.</p>
`,
  ),
  section(
    'terms-links',
    'Enlaces',
    `
<p>1. Como un servicio a nuestros visitantes, nuestro Sitio Web puede contener enlaces de hipertexto que conducen a otros sitios que no son operados o controlados por La Empresa. La Empresa no será considerada responsable de estos sitios y declina toda responsabilidad en relación con su contenido, legalidad, exactitud o funciones.</p>
<p>2. La creación de cualquier hipervínculo a nuestro Sitio Web está prohibida sin el previo consentimiento por escrito de La Empresa.</p>
`,
  ),
  section(
    'terms-misc',
    'Otros',
    `
<p>1. Las presentes condiciones de uso enmarcan la totalidad del acuerdo celebrado entre La Empresa y usted como usuario sobre el acceso y el uso del Sitio Web y su contenido. Todos los otros términos y condiciones emitidos por La Empresa, que rijan la relación con usted, en particular con cualquier servicio o compra de productos, serán complementarios a las Condiciones de Uso.</p>
<p>2. El hecho de que La Empresa tolere una violación por parte de usted de una de las obligaciones establecidas en las Condiciones de Uso, o no desee hacer valer un derecho que se le atribuye en virtud del mismo o en virtud de la ley, no se interpretará como una renuncia por parte de La Empresa a invocar y aplicar sus derechos.</p>
<p>3. En caso de que alguna cláusula de las Condiciones de Uso, existente o futura, sea considerada ilegal por la ley o las regulaciones aplicables o por decisión judicial, tal disposición será considerada como afectada, manteniéndose todas las demás disposiciones de las Condiciones de Uso en pleno vigor y efecto entre usted y La Empresa.</p>
<p>4. Los títulos de los artículos de las Condiciones de Uso son puramente indicativos y no deberán alterar o modificar de ninguna manera los términos y condiciones.</p>
`,
  ),
  section(
    'terms-acceptance-of-terms',
    'Aceptación de los términos de uso',
    `
<p>1. Los presentes términos de uso regulan las relaciones entre La Empresa y los usuarios de los servicios brindados a través de este Sitio Web y están sujetos a las presentes condiciones.</p>
<p>2. Si el usuario se registra y pulsa el ícono “Registrarme”, significará que dicho usuario reconoce que ha leído, entendido y aceptado los presentes términos y condiciones y que cumplirá con ellos.</p>
<p>3. En el caso de que no se cumplan los términos de uso, La Empresa se reserva el derecho, sin indemnización alguna y sin previo aviso, de suspender y/o denegar el acceso en el futuro a todos o parte de los servicios disponibles en este Sitio Web, sin perjuicio de las diferentes causas de procesos judiciales o contractuales que pudiera demandar.</p>
`,
  ),
  section(
    'terms-registration',
    'Registro',
    `
<p>1. A fin de hacer uso de los servicios de venta ofrecidos en el Sitio Web el usuario deberá registrarse informando sus datos personales. En caso que decida registrarse, se informa que el mismo implica la aceptación de los presentes términos de uso.</p>
<p>2. El usuario tiene la obligación de proporcionar información precisa, completa y actualizada.</p>
<p>3. La clave de acceso es estrictamente personal e intransferible. El usuario tiene la obligación de no divulgar su contraseña a terceros. De conformidad con los presentes términos de uso y la ley, el usuario es responsable de las posibles acciones realizadas por cualquier persona que utilice su contraseña, incluso si el usuario en cuestión no tiene conocimiento de ello. El usuario tiene la obligación de denunciar a La Empresa cualquier uso no autorizado de su contraseña tan pronto como sea posible.</p>
`,
  ),
  section(
    'terms-prices',
    'Precios',
    `
<p>1. Los precios a pagar por los productos que usted solicite son aquellos publicados por La Empresa en este Sitio Web, a la fecha en que se formaliza el pedido. Los precios incluyen IVA.</p>
<p>2. Los cargos de envío serán sin cargo en base a los montos mínimos de compra indicados en este Sitio Web, pudiendo La Empresa modificar los mismos en cualquier momento.</p>
<p>3. Los pagos de los productos podrán realizarse únicamente a través de este Sitio Web y por los medios de pago indicados y aceptados en el checkout.</p>
`,
  ),
  section(
    'terms-delivery',
    'Entrega',
    `
<p>1. Todos los pedidos confirmados por La Empresa serán enviados a la dirección de entrega que usted especificó al realizar su pedido. En caso de no poder efectuarse la entrega con éxito, el pedido será reingresado y será el cliente el encargado de comunicarse a fin de pactar una nueva entrega.</p>
<p>2. La Empresa hace su mayor esfuerzo para asegurar las entregas dentro de los días que se le informan al usuario al momento de confirmar la recepción del pedido.</p>
`,
  ),
  section(
    'terms-goods-check',
    'Verificación de mercancía',
    `
<p>1. Es su responsabilidad verificar la cantidad y la condición de la mercancía al momento de la entrega.</p>
<p>2. En caso de que usted note algún daño en el producto o que la mercancía esté incompleta, debe notificar directamente a La Empresa a través de los canales de atención al cliente dentro de las 48 hs hábiles de producida la entrega.</p>
`,
  ),
  section(
    'terms-exchanges',
    'Cambios y devoluciones',
    `
<p>1. Para cambios y/o devoluciones de productos el usuario deberá enviar su consulta dentro de los 10 días posteriores a la fecha de recepción de la compra indicando el motivo por el cual solicita el cambio y/o devolución. Solo se aceptarán cambios en la condición y empaque original del producto, acompañados por una factura de compra, siempre que la misma haya sido realizada por este Sitio Web.</p>
<p>2. En caso de que el usuario solicite la devolución del producto, La Empresa procederá a retirarlo por la misma vía en que se hizo entrega. Una vez que La Empresa reciba el producto y verifique que el mismo se encuentre en condiciones de ser cambiado, le reenviará al usuario un nuevo producto respetando las condiciones de entrega estipuladas en estos términos de uso.</p>
`,
  ),
  section(
    'terms-liability-limits',
    'Limitación de las responsabilidades',
    `
<p>1. Las fotografías y textos que ilustran y describen los productos en este Sitio Web no son contractuales y su único propósito es el de informar. La Empresa no será responsable en caso de errores u omisiones en las fotografías o textos mostrados en este Sitio Web.</p>
<p>2. En ningún caso La Empresa será responsable por cualquier daño directo, indirecto o subsecuente de ningún tipo, que pueda surgir en conexión con sus productos, su uso, venta o este Sitio Web.</p>
`,
  ),
  section(
    'terms-force-majeure',
    'Fuerza Mayor',
    `
<p>La Empresa hará todo esfuerzo razonable para cumplir sus obligaciones. Sin embargo, La Empresa no puede hacerse responsable por retrasos o fallas en la entrega causadas por circunstancias más allá de su control razonable. Tales circunstancias incluyen huelgas, guerras, catástrofes naturales o cualquier otra situación que pueda impedir la producción, transportación o entrega de los productos.</p>
`,
  ),
  section(
    'terms-service-changes',
    'Modificación de los servicios',
    `
<p>La Empresa se reserva el derecho, sin indemnización alguna, sin previo aviso y en cualquier momento, a modificar o cancelar, temporal o permanentemente, todos o parte de los servicios disponibles en el presente Sitio Web. El usuario reconoce que La Empresa puede no responsabilizarse de ningún posible daño ocasionado como consecuencia de una modificación o cancelación de los servicios.</p>
`,
  ),
  section(
    'terms-consumer-defense',
    'Defensa del Consumidor',
    `
<p>La Empresa reconoce los derechos de información de los consumidores, por lo cual pone a su disposición un contacto electrónico gratuito a través de tienda@ejemplo.com.ar y los canales de atención al cliente informados en el Sitio Web.</p>
<p>Para conocer sus derechos y obligaciones, los consumidores pueden consultar la Ley de Defensa del Consumidor Nº 24.240 o dirigirse al sitio de la Secretaría de Comercio Interior.</p>
`,
  ),
  section(
    'terms-provisions',
    'Disposiciones varias',
    `
<p>1. La Empresa se reserva el derecho de modificar y/o actualizar los presentes términos de uso sin que ello requiera aviso o requisito alguno. El usuario tiene la obligación de consultar el Sitio Web para conocer las modificaciones y/o actualizaciones realizadas.</p>
<p>2. La factura de compra será enviada en forma electrónica al correo electrónico registrado, conforme a la normativa fiscal vigente.</p>
<p>3. Los títulos de las secciones de los presentes términos de uso se utilizan por razones de conveniencia y no deberán alterar o modificar los términos de ninguna forma.</p>
<p>4. Los presentes Términos de uso serán interpretados conforme a las leyes de la República Argentina.</p>
<p>5. Cualquier controversia que surja de o en relación con el uso del Sitio será resuelta en los tribunales ordinarios competentes, siendo de aplicación el derecho argentino.</p>
`,
  ),
];

/**
 * Cambios y devoluciones — las tarjetas de `legal/exchangesAndReturns/page.tsx`.
 *
 * Dos diferencias con las otras dos páginas, y las dos vienen de que esa página no
 * era una lista de tarjetas con título sino un layout armado:
 *  - la primera tarjeta NO tenía título (era el párrafo de entrada); acá recibe uno,
 *    porque el índice lateral necesita nombrarla.
 *  - los tres "Paso 1/2/3" eran tres tarjetas con ícono; quedan como UNA sección con
 *    tres subtítulos. Tres entradas del índice que dicen "Paso 1", "Paso 2" y
 *    "Paso 3" no le sirven a nadie para navegar.
 */
const EXCHANGES_SECTIONS: LegalSection[] = [
  section(
    'exchanges-terms',
    'Plazos y condiciones generales',
    `
<p>Podés devolver tu compra realizada en nuestra tienda online, <strong>en un plazo de 10 (diez) días desde la fecha de recepción del paquete</strong> y te reembolsaremos el importe total. Si la devolución se realiza fuera de este periodo o el artículo se ha utilizado, estropeado o no se envía en su embalaje original, no aceptaremos la devolución y no se podrá reembolsar el pago. Recordá que al momento de la entrega deberás revisar el buen estado de los productos antes de firmar el remito de entrega. La devolución será aceptada únicamente con productos del mismo pedido. No se aceptarán devoluciones de productos adquiridos en otros canales o realizados en fechas anteriores al pedido a devolver.</p>
`,
  ),
  section(
    'exchanges-restrictions',
    'Restricciones',
    `
<p>No se aceptarán cambios y devoluciones de los productos que se encuentren:</p>
<ul>
<li>Usados</li>
<li>Sin su envase y/o envoltorio original</li>
<li>Sin el comprobante de cambio o devolución generado por el Centro de Atención al cliente</li>
</ul>
`,
  ),
  section(
    'exchanges-how-to',
    '¿Cómo gestionar el cambio?',
    `
<h3>Paso 1</h3>
<p>Comunícate con nuestro Centro de Atención al Cliente para comenzar el trámite de tu devolución. Ellos te indicarán si tu solicitud es autorizada de acuerdo a nuestra política de devoluciones.</p>
<h3>Paso 2</h3>
<p>Si tu solicitud es autorizada, programaremos al retiro del pedido en la dirección que nos indiques. Asegúrate de empacar los artículos en su embalaje original.</p>
<h3>Paso 3</h3>
<p>Primero deberás devolver el producto original para recibir el nuevo producto o el reembolso correspondiente.</p>
`,
  ),
  section(
    'exchanges-support',
    'Centro de atención al cliente',
    `
<p>Para dudas o consultas, podés escribirnos a través de nuestro <a href="/contact" rel="noopener noreferrer">formulario de contacto</a> o comunicarte con nuestro Centro de Atención al Cliente en cualquiera de los canales detallados a continuación:</p>
<ul>
<li>tienda@ejemplo.com.ar</li>
<li>(011) 4762-6226</li>
<li>WhatsApp: (011) 4762-6226</li>
</ul>
`,
  ),
];

/**
 * Los títulos y las `seo_description` salen de los `generateMetadata` de los tres
 * layouts, que es donde ya estaban: así el default no cambia ni el `<h1>` ni el
 * `<title>` de ninguna tienda.
 *
 * Las bajadas (`intro`) sí son NUEVAS — el diseño las pide y antes no existían. Están
 * escritas en genérico a propósito: describen el documento, no a la tienda, así que
 * ninguna marca queda nombrada en un texto que nadie de esa marca escribió.
 */
export const LEGAL_PAGE_DEFAULTS: LegalPages = {
  legals: {
    title: 'Política de privacidad',
    intro:
      'Cómo tratamos tus datos personales: qué información recolectamos, con qué finalidad y de qué manera podés ejercer tus derechos.',
    updated_label: null,
    sections: PRIVACY_SECTIONS,
    seo_description:
      'Cómo tratamos tus datos personales: qué recolectamos, para qué y cómo ejercer tus derechos.',
  },
  conditions: {
    title: 'Términos y condiciones',
    intro:
      'Leé atentamente las condiciones que regulan el uso de este sitio web y la compra de nuestros productos.',
    updated_label: null,
    sections: CONDITIONS_SECTIONS,
    seo_description:
      'Condiciones de uso del sitio y de compra: precios, stock, formas de pago, envíos y garantías.',
  },
  exchangesAndReturns: {
    title: 'Cambios y devoluciones',
    intro:
      'Conocé los plazos, las condiciones y las excepciones para cambiar o devolver un producto comprado en la tienda online.',
    updated_label: null,
    sections: EXCHANGES_SECTIONS,
    seo_description:
      'Plazos y pasos para cambiar o devolver un producto, y cómo gestionamos el reintegro.',
  },
};

/**
 * Saneado del HTML que llega del editor.
 *
 * La lista es MÁS CHICA que la del blog a propósito: no hay `img`, ni `iframe`, ni
 * `pre`/`code`, ni estilos inline. Un texto legal no lleva media, y cada etiqueta que
 * no está acá es superficie de ataque que no hace falta defender. El editor del
 * backoffice tampoco ofrece esos botones, así que no hay nada que se pierda en
 * silencio — que es el fallo que importa: lo que el sanitizador saca no avisa.
 *
 * `h2` NO está permitido, y no es un olvido: el `<h2>` de la página es el NOMBRE de
 * la sección (el encabezado del acordeón). Un `h2` dentro del cuerpo produciría dos
 * encabezados del mismo nivel para el mismo panel y rompería el outline del documento
 * — que en una página legal es justo lo que usa un lector de pantalla para navegar.
 * El cuerpo arranca en `h3`.
 */
export function sanitizeLegalHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'hr', 'blockquote',
      'h3', 'h4',
      'strong', 'em', 'u', 's',
      'ul', 'ol', 'li',
      'a',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    /**
     * `allowProtocolRelative: false` — un `//host/x` es un link EXTERNO escrito con
     * la forma de uno relativo. Los legales linkean a rutas del propio sitio
     * (`/contact`), y esas no llevan esquema, así que la lista de arriba no las toca:
     * lo único que este flag saca es el caso que se disfraza de interno.
     */
    allowProtocolRelative: false,
    allowedSchemesAppliedToAttributes: ['href'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}

const trimToNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Normaliza UNA sección. Devuelve `null` si no tiene nombre o no tiene cuerpo.
 *
 * Las dos condiciones son necesarias y por motivos distintos: sin nombre no hay ítem
 * de índice ni encabezado de acordeón (quedaría un panel anónimo que nadie puede
 * abrir a propósito), y sin cuerpo el panel se abre para mostrar nada. Descartarla es
 * mejor que publicarla a medias, y el editor no puede producirla sin que el operador
 * vea los dos campos vacíos delante.
 */
function normalizeSection(raw: unknown, index: number): LegalSection | null {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = trimToNull(v.name);
  const html = trimToNull(v.html);
  if (!name || !html) return null;

  const clean = sanitizeLegalHtml(html).trim();
  if (!clean) return null;

  return {
    // Un `id` ausente se completa con la posición: sirve de key en el editor y no se
    // publica en ninguna URL (el ancla se deriva del NOMBRE), así que no hace falta
    // que sobreviva a un reordenado.
    id: trimToNull(v.id) ?? `s${index + 1}`,
    name,
    html: clean,
  };
}

/**
 * Lo que se GUARDA de un documento: sólo los campos con contenido, con cada sección
 * saneada. Los vacíos se OMITEN en vez de escribirse como `''`.
 *
 * La diferencia importa: una clave presente con `''` y una clave ausente se leen
 * igual (las dos caen al default), pero sólo la ausente deja el aviso de "estás
 * publicando el texto de ejemplo" prendido. Guardar cadenas vacías apagaría el aviso
 * sin que nadie hubiera escrito una línea.
 */
export function normalizeStoredDoc(raw: unknown): Partial<LegalPageDoc> {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Partial<LegalPageDoc> = {};

  const title = trimToNull(v.title);
  if (title) out.title = title;

  const intro = trimToNull(v.intro);
  if (intro) out.intro = intro;

  const updated = trimToNull(v.updated_label);
  if (updated) out.updated_label = updated;

  if (Array.isArray(v.sections)) {
    const sections = v.sections
      .map((s, i) => normalizeSection(s, i))
      .filter((s): s is LegalSection => s !== null);
    // Un array que quedó vacío NO se guarda: si se guardara, apagaría el aviso y la
    // página publicaría el default igual, o sea que el operador vería su trabajo
    // desaparecer sin ningún motivo visible.
    if (sections.length) out.sections = sections;
  }

  const seo = trimToNull(v.seo_description);
  if (seo) out.seo_description = seo;

  return out;
}

/** Qué páginas tienen texto propio guardado (o sea: NO son el de ejemplo). */
export type LegalPagesCustomized = Record<LegalPageSlug, boolean>;

export type LegalPagesResult = {
  /** Siempre COMPLETO: las tres páginas, con default donde no haya nada guardado. */
  pages: LegalPages;
  customized: LegalPagesCustomized;
};

/**
 * Un documento guardado, completado con el default de su página.
 *
 * `sections` vacío o ausente cae al default A PROPÓSITO, y no es lo mismo que en el
 * resto de los settings del módulo (donde `''` suele significar "ocultá esto"). Acá
 * quedarse sin secciones publicaría una página legal EN BLANCO, y una tienda sin
 * términos y condiciones visibles es peor que una con el texto de ejemplo. Para
 * vaciar una legal hay que sacarle el link del footer, que es otra pantalla.
 */
const mergeDoc = (raw: unknown, fallback: LegalPageDoc): LegalPageDoc => {
  const stored = normalizeStoredDoc(raw);
  return {
    title: stored.title ?? fallback.title,
    intro: stored.intro ?? fallback.intro,
    updated_label: stored.updated_label ?? fallback.updated_label,
    sections: stored.sections ?? fallback.sections,
    seo_description: stored.seo_description ?? fallback.seo_description,
  };
};

/** Completa el valor crudo de `store_setting` sobre los defaults. */
export function mergeLegalPages(raw: unknown): LegalPagesResult {
  const stored = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pages = {} as LegalPages;
  const customized = {} as LegalPagesCustomized;

  for (const slug of LEGAL_PAGE_SLUGS) {
    const own = stored[slug];
    pages[slug] = mergeDoc(own, LEGAL_PAGE_DEFAULTS[slug]);
    // "Personalizada" es que alguien haya guardado SECCIONES. Cambiar sólo el título
    // o la bajada no alcanza: lo que la card avisa es que el CUERPO del documento
    // sigue siendo el de ejemplo.
    customized[slug] = !!normalizeStoredDoc(own).sections;
  }

  return { pages, customized };
}
