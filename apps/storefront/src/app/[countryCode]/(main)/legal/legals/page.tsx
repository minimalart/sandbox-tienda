import { getLegalPage } from '@lib/data/legal-pages';
import LegalDocument from '@modules/legal/components/legalDocument';
import HardcodedPrivacyPolicy from '@modules/legal/components/hardcoded/privacy-policy';

/**
 * Política de privacidad. El texto se edita en el backoffice
 * (Preferencias → Legales) y el backend lo devuelve completo, con su texto por
 * defecto si la tienda todavía no guardó el suyo.
 *
 * Server component: era `'use client'` sin necesitarlo —no tiene estado ni
 * handlers— y eso obligaba a que el `generateMetadata` viviera en el layout. Ahora
 * el fetch está acá y `cache()` lo comparte con el del layout.
 */
export default async function LegalPage() {
  const page = await getLegalPage('legals');
  // `null` = el backend no contestó, no "no hay texto". Ver `getLegalPage`.
  if (!page) return <HardcodedPrivacyPolicy />;
  return <LegalDocument page={page} />;
}
