import { defineWidgetConfig } from '@medusajs/admin-sdk';

/**
 * Atribución de Minimalart en el login del admin (/app/login).
 *
 * El dashboard expone zonas de widgets en el login (`getWidgets("login.after")`),
 * así que NO hace falta patchear el build (vite-plugin-unlock): alcanza con un
 * widget en la zona `login.after`.
 */
const LoginAttribution = () => {
  return (
    <a
      href="https://minimalart.co/?utm_source=admin&utm_medium=login&utm_campaign=mercatto"
      target="_blank"
      rel="noreferrer"
      className="transition-fg text-ui-fg-muted hover:text-ui-fg-subtle mt-1 flex items-center justify-center gap-1.5"
    >
      <span className="txt-small font-medium">Minimalart</span>
      <span className="txt-small">· Evolution by design</span>
    </a>
  );
};

export const config = defineWidgetConfig({
  // El login renderiza getWidgets("login.after") debajo del formulario.
  zone: 'login.after',
});

export default LoginAttribution;
