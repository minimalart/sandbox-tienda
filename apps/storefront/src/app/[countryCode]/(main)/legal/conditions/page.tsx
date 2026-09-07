import { getLegalPage } from '@lib/data/legal-pages';
import LegalDocument from '@modules/legal/components/legalDocument';
import HardcodedTermsAndConditions from '@modules/legal/components/hardcoded/terms-and-conditions';

/**
 * Términos y condiciones. El texto se edita en el backoffice
 * (Preferencias → Legales); ver `legals/page.tsx` para el porqué del fallback.
 *
 * Cambia un ancla: la versión hardcodeada tenía una sección con
 * `sectionId="changes-and-returns"`, y ahora las anclas se derivan del NOMBRE de la
 * sección (ver `modules/legal/anchors.ts`), así que esa cláusula pasa a ser
 * `#cambios-y-devoluciones`. Nada en el repo linkea la vieja (comprobado), pero un
 * mail o una campaña que apunte a `#changes-and-returns` ahora cae al tope de la
 * página.
 */
export default async function ConditionsPage() {
  const page = await getLegalPage('conditions');
  if (!page) return <HardcodedTermsAndConditions />;
  return <LegalDocument page={page} />;
}
