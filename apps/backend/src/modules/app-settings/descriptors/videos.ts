import { defineSettings } from './types';

/** Runtime settings. Account fields are edited in Settings > Integrations.
 * Shared providers retain their persisted namespace for compatibility. */
export default defineSettings({
  namespace: 'extension:videos',
  title: 'Videos (Vimeo)',
  /**
   * `instance`: hay UNA app registrada en Vimeo por instancia y una sola carpeta
   * de destino. El redirect post-OAuth es una ruta del admin, que tampoco varía
   * por tienda. Lo que sí es por tienda son los videos, y eso ya lo resuelve
   * `VIMEO_VIDEO_SITE_SCOPE` sobre la tabla.
   */
  defaultScope: 'instance',
  settings: [
    {
      key: 'VIMEO_CLIENT_ID',
      env: ['VIMEO_CLIENT_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Client ID',
    },
    {
      key: 'VIMEO_CLIENT_SECRET',
      env: ['VIMEO_CLIENT_SECRET'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Client secret',
    },
    {
      key: 'VIMEO_ACCESS_TOKEN',
      env: ['VIMEO_ACCESS_TOKEN'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Access token',
      help: 'Opcional si conectás tu cuenta mediante OAuth.',
    },
    {
      key: 'VIMEO_FOLDER_URI',
      env: ['VIMEO_FOLDER_URI'],
      type: 'string',
      tier: 'runtime',
      group: 'Biblioteca',
      label: 'Carpeta de Vimeo',
    },
    {
      key: 'VIMEO_OAUTH_REDIRECT_SUCCESS',
      env: ['VIMEO_OAUTH_REDIRECT_SUCCESS'],
      type: 'string',
      tier: 'runtime',
      group: 'Conexión con Vimeo',
      label: 'Destino después de conectar la cuenta',
      // Una oración. Que sea un 302 del NAVEGADOR —y que por eso una URL absoluta hacia
      // afuera deje la conexión hecha y al operador perdido— es la sección "El destino
      // después de conectar es un redirect del navegador" del drawer.
      help: 'A dónde manda el callback de OAuth cuando la conexión sale bien: normalmente una ruta relativa del admin.',
      placeholder: '/app/videos',
      default: '/app/videos',
      maxLength: 512,
    },
  ],
});
