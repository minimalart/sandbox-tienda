/**
 * Fixtures XML para tests del módulo ARCA (constantes/funciones string para
 * no depender de fs ni de paths post-build). Shapes tomados de respuestas
 * reales de WSAA y personaServiceA5 (datos ficticios).
 */

/** Respuesta de loginCms: loginTicketResponse viene XML-escapado adentro. */
export function wsaaLoginResponse(opts: {
  token?: string;
  sign?: string;
  expirationIso: string;
}): string {
  const token = opts.token ?? 'TOKEN_FAKE==';
  const sign = opts.sign ?? 'SIGN_FAKE==';
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ns1:loginCmsResponse xmlns:ns1="http://wsaa.view.sua.dvadac.desein.afip.gov">
      <ns1:loginCmsReturn>&lt;?xml version="1.0" encoding="UTF-8" standalone="yes"?&gt;
&lt;loginTicketResponse version="1.0"&gt;
  &lt;header&gt;
    &lt;source&gt;CN=wsaa, O=AFIP&lt;/source&gt;
    &lt;destination&gt;CN=cert, O=empresa&lt;/destination&gt;
    &lt;uniqueId&gt;123456&lt;/uniqueId&gt;
    &lt;generationTime&gt;2026-07-16T10:00:00.000-03:00&lt;/generationTime&gt;
    &lt;expirationTime&gt;${opts.expirationIso}&lt;/expirationTime&gt;
  &lt;/header&gt;
  &lt;credentials&gt;
    &lt;token&gt;${token}&lt;/token&gt;
    &lt;sign&gt;${sign}&lt;/sign&gt;
  &lt;/credentials&gt;
&lt;/loginTicketResponse&gt;</ns1:loginCmsReturn>
    </ns1:loginCmsResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export const WSAA_FAULT_TA_VALIDO = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>ns1:coms.alreadyAuthenticated</faultcode>
      <faultstring>El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;

export const WSAA_FAULT_GENERICO = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>ns1:cms.bad</faultcode>
      <faultstring>Error de firma CMS</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;

function personaEnvelope(personaReturnXml: string): string {
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:getPersona_v2Response xmlns:ns2="http://a5.soap.ws.server.puc.sr/">
      <personaReturn>
        ${personaReturnXml}
      </personaReturn>
    </ns2:getPersona_v2Response>
  </soap:Body>
</soap:Envelope>`;
}

/** Sociedad responsable inscripto (impuesto 30 + otros), con localidad. */
export const PERSONA_RI = personaEnvelope(`<datosGenerales>
          <domicilioFiscal>
            <codPostal>5000</codPostal>
            <descripcionProvincia>CORDOBA</descripcionProvincia>
            <direccion>BV SAN JUAN 100</direccion>
            <localidad>CORDOBA</localidad>
            <tipoDomicilio>FISCAL</tipoDomicilio>
          </domicilioFiscal>
          <estadoClave>ACTIVO</estadoClave>
          <idPersona>30712426558</idPersona>
          <razonSocial>MINIMALART S.A.</razonSocial>
          <tipoClave>CUIT</tipoClave>
          <tipoPersona>JURIDICA</tipoPersona>
        </datosGenerales>
        <datosRegimenGeneral>
          <impuesto>
            <descripcionImpuesto>GANANCIAS SOCIEDADES</descripcionImpuesto>
            <estado>ACTIVO</estado>
            <idImpuesto>10</idImpuesto>
          </impuesto>
          <impuesto>
            <descripcionImpuesto>IVA</descripcionImpuesto>
            <estado>ACTIVO</estado>
            <idImpuesto>30</idImpuesto>
          </impuesto>
          <impuesto>
            <descripcionImpuesto>REG. SEG. SOCIAL EMPLEADOR</descripcionImpuesto>
            <estado>BAJA DE OFICIO</estado>
            <idImpuesto>301</idImpuesto>
          </impuesto>
        </datosRegimenGeneral>
        <metadata>
          <fechaHora>2026-07-16T12:00:00.000-03:00</fechaHora>
          <servidor>fixture</servidor>
        </metadata>`);

/** Exento: UN solo <impuesto> (objeto, no array) con id 32. Sin localidad (CABA). */
export const PERSONA_EXENTA_CABA = personaEnvelope(`<datosGenerales>
          <domicilioFiscal>
            <codPostal>1407</codPostal>
            <descripcionProvincia>CIUDAD AUTONOMA BUENOS AIRES</descripcionProvincia>
            <direccion>AV RIVADAVIA 7423</direccion>
          </domicilioFiscal>
          <estadoClave>ACTIVO</estadoClave>
          <idPersona>30500001735</idPersona>
          <razonSocial>FUNDACION EJEMPLO</razonSocial>
          <tipoPersona>JURIDICA</tipoPersona>
        </datosGenerales>
        <datosRegimenGeneral>
          <impuesto>
            <descripcionImpuesto>IVA EXENTO</descripcionImpuesto>
            <estado>ACTIVO</estado>
            <idImpuesto>32</idImpuesto>
          </impuesto>
        </datosRegimenGeneral>`);

/** Persona física monotributista (sin razonSocial, sin codPostal). */
export const PERSONA_MONOTRIBUTO = personaEnvelope(`<datosGenerales>
          <apellido>PEREZ</apellido>
          <nombre>JUAN</nombre>
          <domicilioFiscal>
            <descripcionProvincia>BUENOS AIRES</descripcionProvincia>
            <direccion>CALLE FALSA 123</direccion>
            <localidad>LANUS</localidad>
          </domicilioFiscal>
          <estadoClave>ACTIVO</estadoClave>
          <idPersona>20222222223</idPersona>
          <tipoPersona>FISICA</tipoPersona>
        </datosGenerales>
        <datosMonotributo>
          <categoriaMonotributo>
            <descripcionCategoria>D</descripcionCategoria>
            <idCategoria>24</idCategoria>
          </categoriaMonotributo>
        </datosMonotributo>`);

export const PERSONA_FAULT_NO_EXISTE = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>No existe persona con ese Id</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;

export const PERSONA_ERROR_CONSTANCIA = personaEnvelope(`<errorConstancia>
          <apellido>DOE</apellido>
          <error>No existe persona con ese Id</error>
          <idPersona>20111111112</idPersona>
        </errorConstancia>`);
