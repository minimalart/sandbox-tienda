import type { JsonLdObject } from "@lib/util/seo/jsonld";

/**
 * Renderiza uno o varios objetos JSON-LD como <script type="application/ld+json">.
 * Server component: el script queda en el HTML renderizado (lo lee Google y el
 * crawler propio del módulo SEO & GEO). `null`/`undefined` se ignoran.
 */
export default function JsonLd({ data }: { data: JsonLdObject | Array<JsonLdObject | null | undefined> | null }) {
  const items = (Array.isArray(data) ? data : [data]).filter(Boolean) as JsonLdObject[];
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
