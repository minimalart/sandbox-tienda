import { getActiveTenant } from "@lib/site-config/active-tenant";
import { canonicalUrl } from '@lib/util/site-url';
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { Metadata } from "next";

/**
 * `getActiveTenant()`, no `getTenant()`.
 *
 * `getTenant()` (`site-config/resolver.ts`) es el resolver ESTÁTICO: devuelve siempre
 * `defaultConfig` (`name: "Mercatto"`) sin mirar la request. Esta página lo usaba en
 * los dos lugares, así que en desdeelsur emitía
 * `description: "Conocé la historia y filosofía de Mercatto."` y, peor, escribía
 * "Mercatto" en el CUERPO VISIBLE.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getActiveTenant();

  return {
    title: 'Nosotros',
    // El sufijo de marca lo pone el `title.template` del root layout: repetirlo acá
    // emitía `Página | Marca | Marca`.
    alternates: { canonical: await canonicalUrl("/about") },
    description: `Conocé la historia y filosofía de ${tenant.name}.`,
  };
}

/**
 * El copy institucional sale del TENANT, y si no está NO SE INVENTA.
 *
 * Acá había tres párrafos hardcodeados de una marca de fragancias: "Inspirados por la
 * sensorialidad", "nace con la misión de transformar espacios cotidianos a través de
 * aromas memorables", "Colaboramos con estudios creativos y laboratorios regionales",
 * "el proceso de selección de fragancias, montaje de equipos". Una pinturería de
 * Bariloche los estuvo publicando como su propia historia (DESDEELSUR-49, punto 4).
 *
 * Cambiar el resolver NO alcanzaba: con `getActiveTenant()` el mismo párrafo pasa a
 * decir "Desde el sur nace con la misión de … aromas memorables". Sigue siendo falso,
 * sólo mejor firmado.
 *
 * Así que la descripción sale de `tenant.metadata.description` —editable por tienda— y
 * **cuando no está, el párrafo no se renderiza**. Es la misma regla que el PR #940 fijó
 * para `llms.txt` y que ya rige en el footer: un texto institucional fabricado es peor
 * que la ausencia, porque es lo que la gente (y los modelos) van a repetir del negocio.
 *
 * Los dos bloques de "Diseño consciente" / "Experiencias personalizadas" se BORRAN y no
 * se reemplazan: eran invención entera, no había nada que reencuadrar. Lo que queda es
 * verdadero para cualquier tienda: quién es, y por dónde se la contacta.
 */
export default async function AboutPage() {
  const tenant = await getActiveTenant();
  const description = tenant.metadata?.description?.trim();

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        <p className="text-[--primary-color] text-sm uppercase tracking-wide">
          Nosotros
        </p>
        <h1 className="mt-3 font-semibold text-4xl text-gray-900">
          Sobre {tenant.name}
        </h1>
        {description ? (
          <p className="mt-6 max-w-2xl text-base text-gray-600">{description}</p>
        ) : null}
        <LocalizedClientLink
          href="/contact"
          className="mt-10 inline-flex items-center rounded-full bg-[--primary-color] px-6 py-3 font-medium text-sm text-white transition-opacity hover:opacity-90"
        >
          Contactanos
        </LocalizedClientLink>
      </section>
    </div>
  );
}
