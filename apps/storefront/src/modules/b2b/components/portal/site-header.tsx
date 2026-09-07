"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { useSitePrefix } from "@lib/site-config/context";
import { stripSitePrefix } from "@lib/site-config/site-path";

const TITLES: Array<[string, string]> = [
  ["/b2b/pedidos/nuevo", "Nuevo pedido"],
  ["/b2b/pedidos", "Pedidos"],
  ["/b2b/empresa", "Mi empresa"],
  ["/b2b", "Inicio"],
];

export default function SiteHeader({
  companyName,
  logoUrl,
}: {
  companyName?: string;
  logoUrl?: string;
}) {
  const sitePrefix = useSitePrefix();
  const path = stripSitePrefix(usePathname() || "", sitePrefix);
  const title =
    TITLES.find(([h]) => path === h || path.startsWith(`${h}/`))?.[1] ?? "Portal Mayorista";

  const companyInitial = (companyName || "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <h1 className="text-sm font-medium text-foreground">{title}</h1>

      {/* Logo / nombre de la empresa en el extremo opuesto al breadcrumb */}
      {companyName ? (
        <div className="ml-auto flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={companyName}
              className="size-7 shrink-0 rounded-md border border-border object-contain"
            />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
              {companyInitial}
            </span>
          )}
          <span className="hidden truncate text-sm font-medium text-foreground sm:inline">
            {companyName}
          </span>
        </div>
      ) : null}
    </header>
  );
}
