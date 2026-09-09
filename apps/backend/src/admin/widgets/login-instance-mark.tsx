import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { InstanceMark } from '../components/common/instance-mark';

/**
 * La marca de la instalación en el login, para saber a QUÉ backend le estás por dar
 * las credenciales.
 *
 * `login.before` renderiza entre el encabezado y el formulario. Queda DEBAJO del
 * `<AvatarBox />` con el logo de Medusa, que está fuera de toda zona de widgets y no
 * se puede reemplazar sin patchear el dashboard.
 *
 * Hermano de `login-attribution.tsx`, que ocupa `login.after`.
 */
const LoginInstanceMark = () => <InstanceMark variant="login" />;

export const config = defineWidgetConfig({
  zone: 'login.before',
});

export default LoginInstanceMark;
