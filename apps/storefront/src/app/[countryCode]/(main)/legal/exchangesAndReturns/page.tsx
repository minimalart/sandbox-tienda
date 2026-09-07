import { getLegalPage } from '@lib/data/legal-pages';
import LegalDocument from '@modules/legal/components/legalDocument';
import HardcodedExchangesAndReturns from '@modules/legal/components/hardcoded/exchanges-and-returns';

/**
 * Cambios y devoluciones. El texto se edita en el backoffice
 * (Preferencias → Legales); ver `legals/page.tsx` para el porqué del fallback.
 *
 * Es la de las tres que más cambia de forma: la versión hardcodeada tenía tres
 * tarjetas de "Paso 1/2/3" con íconos y una grilla de canales de contacto con el mail
 * y el teléfono ESCRITOS EN EL CÓDIGO (`tienda@ejemplo.com.ar`, `(011) 4762-6226`).
 * Los pasos pasan a ser subtítulos del texto y los canales a una lista — pero ahora
 * el operador puede corregir su propio mail sin un deploy, que es exactamente el
 * problema que había.
 */
export default async function ExchangesAndReturnsPage() {
  const page = await getLegalPage('exchangesAndReturns');
  if (!page) return <HardcodedExchangesAndReturns />;
  return <LegalDocument page={page} />;
}
