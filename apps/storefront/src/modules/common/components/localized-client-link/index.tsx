"use client";

import { useDemoHref, useTenant } from "@lib/site-config/context";
import { internalHref } from "@lib/util/internal-href";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { usesQuickViewOnly } from "@lib/site-config/template-helpers";
import type React from "react";

const ProductQuickViewModal = dynamic(() => import("../quick-view-modal"), { ssr: false });

/**
 * URLs in this app no longer include the country code as a path segment
 * (middleware rewrites /cart -> /<country>/cart internally). This component
 * is kept as a thin wrapper over `next/link` so existing callsites keep working.
 *
 * Inside a demo session it also prepends the `/demo/{slug}` prefix so the slug
 * stays in the URL across the whole demo (handled by useDemoHref). Callsites
 * keep using clean hrefs like `/store`; the prefix is injected automatically.
 *
 * Este componente es el ÚNICO camino de los links internos del storefront (139
 * call sites, ninguno con una URL absoluta escrita a mano), así que es donde se
 * contiene un href de CONTENIDO que llegó absoluto a un host nuestro. En
 * desdeelsur los banners y las tiles del home estaban guardados apuntando a
 * `https://desdeelsur.minimalart.studio/store?...`: `next/link` con href
 * absoluto hace navegación de documento completo, así que producción se llevaba
 * al visitante al dominio de preview (DESDEELSUR-61 / BUG-04).
 *
 * `internalHref` corre ANTES de `demoHref` a propósito: prefijar `/demo/{slug}`
 * a una URL absoluta produce un href sin sentido. Un link externo de verdad pasa
 * intacto — ver `lib/util/internal-href.ts`.
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode;
  href: string;
  className?: string;
  onClick?: () => void;
  passHref?: true;
  [x: string]: any;
}) => {
  const demoHref = useDemoHref();
  const tenant = useTenant();
  const [open, setOpen] = useState(false);
  const productHandle = /^\/products\/([^/?#]+)/.exec(href)?.[1];
  if (usesQuickViewOnly(tenant.template) && productHandle) {
    // Navigation callbacks close the cart drawer. Keep its quick view mounted
    // while browsing the product, and restore focus to this button on close.
    const { onClick, passHref, ...buttonProps } = props;
    return <>
      <button {...buttonProps} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <ProductQuickViewModal product={{ handle: decodeURIComponent(productHandle) }} open onClose={() => setOpen(false)} />}
    </>;
  }
  return (
    <Link href={demoHref(internalHref(href))} {...props}>
      {children}
    </Link>
  );
};

export default LocalizedClientLink;
