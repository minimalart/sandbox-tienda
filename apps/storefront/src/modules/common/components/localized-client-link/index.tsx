"use client";

import { useDemoHref } from "@lib/site-config/context";
import Link from "next/link";
import type React from "react";

/**
 * URLs in this app no longer include the country code as a path segment
 * (middleware rewrites /cart -> /<country>/cart internally). This component
 * is kept as a thin wrapper over `next/link` so existing callsites keep working.
 *
 * Inside a demo session it also prepends the `/demo/{slug}` prefix so the slug
 * stays in the URL across the whole demo (handled by useDemoHref). Callsites
 * keep using clean hrefs like `/store`; the prefix is injected automatically.
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
  return (
    <Link href={demoHref(href)} {...props}>
      {children}
    </Link>
  );
};

export default LocalizedClientLink;
