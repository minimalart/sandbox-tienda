import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Toaster } from '@medusajs/ui';
import { TemplatesTab } from '../components/templates-tab';
import { whatsappLabel } from '../../../translations/whatsapp';

const TemplatesPage = () => {
  return (
    <>
      <TemplatesTab />
      <Toaster />
    </>
  );
};

// Label del sidebar resuelto por idioma persistido (ver nota en inbox/page.tsx:
// Medusa no traduce los labels de extensión). Breadcrump como función, reactivo.
export const config = defineRouteConfig({
  label: whatsappLabel('NAV_TEMPLATES'),
  rank: 1,
});

export const handle = {
  breadcrumb: () => whatsappLabel('NAV_TEMPLATES'),
};

export default TemplatesPage;
