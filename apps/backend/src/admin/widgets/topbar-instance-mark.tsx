import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { InstanceMark } from '../components/common/instance-mark';

/**
 * La marca de la instalación en la barra superior, en TODAS las pantallas del admin.
 *
 * `topbar` es una injection zone de verdad (está en `INJECTION_ZONES` de
 * `@medusajs/admin-shared`): el shell la monta con
 * `<LayoutComposer widgetsZonePrefix="topbar">`, al lado de Notificaciones y del
 * botón de Personalizar layout. Es el único punto GLOBAL que expone el dashboard —
 * las demás zonas son por pantalla—, así que es acá o en ningún lado.
 *
 * Efecto lateral bienvenido: al pasar por el `LayoutComposer`, el operador puede
 * reordenarlo o correrlo desde el propio menú de Personalizar layout.
 */
const TopbarInstanceMark = () => <InstanceMark variant="topbar" />;

export const config = defineWidgetConfig({
  zone: 'topbar',
});

export default TopbarInstanceMark;
