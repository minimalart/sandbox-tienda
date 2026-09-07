"use strict";
/**
 * Fixtures XML para tests del módulo ARCA (constantes/funciones string para
 * no depender de fs ni de paths post-build). Shapes tomados de respuestas
 * reales de WSAA y personaServiceA5 (datos ficticios).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERSONA_ERROR_CONSTANCIA = exports.PERSONA_FAULT_NO_EXISTE = exports.PERSONA_MONOTRIBUTO = exports.PERSONA_EXENTA_CABA = exports.PERSONA_RI = exports.WSAA_FAULT_GENERICO = exports.WSAA_FAULT_TA_VALIDO = void 0;
exports.wsaaLoginResponse = wsaaLoginResponse;
/** Respuesta de loginCms: loginTicketResponse viene XML-escapado adentro. */
function wsaaLoginResponse(opts) {
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
exports.WSAA_FAULT_TA_VALIDO = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>ns1:coms.alreadyAuthenticated</faultcode>
      <faultstring>El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;
exports.WSAA_FAULT_GENERICO = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>ns1:cms.bad</faultcode>
      <faultstring>Error de firma CMS</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;
function personaEnvelope(personaReturnXml) {
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
exports.PERSONA_RI = personaEnvelope(`<datosGenerales>
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
exports.PERSONA_EXENTA_CABA = personaEnvelope(`<datosGenerales>
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
exports.PERSONA_MONOTRIBUTO = personaEnvelope(`<datosGenerales>
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
exports.PERSONA_FAULT_NO_EXISTE = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>No existe persona con ese Id</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
exports.PERSONA_ERROR_CONSTANCIA = personaEnvelope(`<errorConstancia>
          <apellido>DOE</apellido>
          <error>No existe persona con ese Id</error>
          <idPersona>20111111112</idPersona>
        </errorConstancia>`);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4dHVyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2FyY2EvZml4dHVyZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUdILDhDQTJCQztBQTVCRCw2RUFBNkU7QUFDN0UsU0FBZ0IsaUJBQWlCLENBQUMsSUFJakM7SUFDQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxJQUFJLGNBQWMsQ0FBQztJQUMzQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLGFBQWEsQ0FBQztJQUN4QyxPQUFPOzs7Ozs7Ozs7OzRCQVVtQixJQUFJLENBQUMsYUFBYTs7O21CQUczQixLQUFLO2tCQUNOLElBQUk7Ozs7O29CQUtGLENBQUM7QUFDckIsQ0FBQztBQUVZLFFBQUEsb0JBQW9CLEdBQUc7Ozs7Ozs7b0JBT2hCLENBQUM7QUFFUixRQUFBLG1CQUFtQixHQUFHOzs7Ozs7O29CQU9mLENBQUM7QUFFckIsU0FBUyxlQUFlLENBQUMsZ0JBQXdCO0lBQy9DLE9BQU87Ozs7VUFJQyxnQkFBZ0I7Ozs7aUJBSVQsQ0FBQztBQUNsQixDQUFDO0FBRUQsMkVBQTJFO0FBQzlELFFBQUEsVUFBVSxHQUFHLGVBQWUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztvQkFrQ3RCLENBQUMsQ0FBQztBQUV0QixxRkFBcUY7QUFDeEUsUUFBQSxtQkFBbUIsR0FBRyxlQUFlLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7OytCQWlCcEIsQ0FBQyxDQUFDO0FBRWpDLHNFQUFzRTtBQUN6RCxRQUFBLG1CQUFtQixHQUFHLGVBQWUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7NEJBaUJ2QixDQUFDLENBQUM7QUFFakIsUUFBQSx1QkFBdUIsR0FBRzs7Ozs7OztpQkFPdEIsQ0FBQztBQUVMLFFBQUEsd0JBQXdCLEdBQUcsZUFBZSxDQUFDOzs7OzJCQUk3QixDQUFDLENBQUMifQ==