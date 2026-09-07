import { defineSettings } from './types';

/** Minimalart provides the shared CUIT lookup account for every company.
 * The queried CUIT is request data, never the identity used to authenticate. */
export default defineSettings({
  namespace: 'extension:fiscal-documentation',
  title: 'Documentación Fiscal (ARCA)',
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'ARCA_CERTIFICATE_PATH',
      reason:
        'Ruta en el filesystem del contenedor: no se puede gestionar desde la base (el valor guardado sería un nombre de archivo que hay que resolver en cada réplica, y en un droplet ese filesystem se rehace en cada deploy). Sólo se consulta si ninguna capa aportó ARCA_CERTIFICATE_BASE64, y sólo a nivel instancia. Para cargar el certificado desde el admin usá ARCA_CERTIFICATE_BASE64 en Integraciones → Globales → ARCA / AFIP.',
    },
    {
      key: 'ARCA_PRIVATE_KEY_PATH',
      reason:
        'Mismo motivo que ARCA_CERTIFICATE_PATH: una ruta de filesystem no viaja con el dato. Sólo se consulta si ninguna capa aportó ARCA_PRIVATE_KEY_BASE64, y sólo a nivel instancia.',
    },
  ],
  settings: [
    {
      key: 'ARCA_ENVIRONMENT',
      env: ['ARCA_ENVIRONMENT'],
      type: 'enum',
      tier: 'runtime',
      group: 'Conexión',
      label: 'Entorno de ARCA',
      help: 'Homologación es el entorno de PRUEBA de AFIP; producción es el real.',
      options: [
        { value: 'homologacion', label: 'Homologación (pruebas)' },
        { value: 'production', label: 'Producción (real)' },
      ],
      default: 'homologacion',
      required: true,
    },
    {
      key: 'ARCA_WSAA_SERVICE',
      env: ['ARCA_WSAA_SERVICE'],
      type: 'string',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      label: 'Servicio WSAA',
      help: 'El servicio para el que se pide el ticket de acceso: `ws_sr_constancia_inscripcion` es el único que este módulo sabe consumir.',
      placeholder: 'ws_sr_constancia_inscripcion',
      default: 'ws_sr_constancia_inscripcion',
      pattern: '^[a-z0-9_]+$',
      maxLength: 64,
    },

    {
      key: 'ARCA_CUIT_REPRESENTADA',
      env: ['ARCA_CUIT_REPRESENTADA'],
      type: 'string',
      tier: 'runtime',
      group: 'Identidad fiscal',
      label: 'CUIT de Minimalart',
      help: 'CUIT titular de la cuenta de Minimalart que presta el servicio de consulta. No es el CUIT de la empresa consultada.',
      placeholder: '30712426558',
      pattern: '^[0-9]{11}$',
      maxLength: 11,
      required: true,
    },

    {
      key: 'ARCA_CERTIFICATE_BASE64',
      env: ['ARCA_CERTIFICATE_BASE64'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Certificado X.509',
      help: 'El certificado que AFIP emitió para la CUIT representada, en base64 o pegado como PEM crudo.',
      required: true,
    },
    {
      key: 'ARCA_PRIVATE_KEY_BASE64',
      env: ['ARCA_PRIVATE_KEY_BASE64'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Clave privada del certificado',
      help: 'La clave privada del par, en base64 o PEM crudo: es lo más sensible de todo el backend.',
      required: true,
    },
  ],
});
