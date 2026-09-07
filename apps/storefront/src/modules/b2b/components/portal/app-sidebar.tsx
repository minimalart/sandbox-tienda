"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@lib/hooks/use-auth";
import { useSiteHref, useSitePrefix } from "@lib/site-config/context";
import { stripSitePrefix } from "@lib/site-config/site-path";
import { MercattoIcon, MercattoLogo, MinimalartAttribution } from "@modules/b2b/components/b2b-brand";
import { usePortalTheme } from "@modules/b2b/components/portal/theme";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import {
  ChevronsUpDown,
  ClipboardList,
  Home,
  LogOut,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

const NAV = [
  { name: "Inicio", href: "/b2b", Icon: Home, exact: true },
  // `match`: rutas extra que mantienen "Pedidos" activo (el checkout es parte del
  // flujo de armado de pedido, aunque cuelgue de /b2b/checkout y no de /pedidos).
  { name: "Pedidos", href: "/b2b/pedidos", Icon: ClipboardList, match: ["/b2b/pedidos", "/b2b/checkout"] },
  { name: "Mi empresa", href: "/b2b/empresa", Icon: Building2 },
];

// Quita el prefijo de país (/ar) y el del demo (/demo/{slug}) para obtener la
// ruta lógica (/b2b/...) con la que se compara la nav activa.


export default function AppSidebar({
  userName,
  email,
  storeLogo,
  storeIcon,
}: {
  userName?: string;
  email?: string;
  /** Logo de la tienda del demo. Ausente = logo de Mercatto (store principal). */
  storeLogo?: string;
  /** Ícono cuadrado (favicon) de la tienda del demo, para el sidebar colapsado. */
  storeIcon?: string;
}) {
  const pathname = usePathname() || "";
  const siteHref = useSiteHref();
  const sitePrefix = useSitePrefix();
  const path = stripSitePrefix(pathname, sitePrefix);
  const { logout } = useAuth();
  const { dark, toggle } = usePortalTheme();

  const onLogout = async () => {
    await logout();
    // Preservar el prefijo /demo/{slug} para no salir del contexto del demo.
    window.location.href = siteHref("/b2b/login");
  };

  const userInitials =
    (userName || email || "?")
      .split(" ")
      .map((s) => s.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <Sidebar collapsible="icon">
      {/* Marca de la tienda (del demo si aplica; Mercatto en el store principal).
          El logo de la empresa compradora va en el header. */}
      <SidebarHeader>
        <div className="px-1 py-1.5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {storeLogo ? (
            <>
              {/* Expandido: logo completo. Colapsado: ícono cuadrado (favicon)
                  o, si no hay, el logo contenido en el ancho del riel. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storeLogo}
                alt="Tienda"
                className="h-7 w-auto object-contain group-data-[collapsible=icon]:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storeIcon ?? storeLogo}
                alt="Tienda"
                className="hidden size-7 shrink-0 object-contain group-data-[collapsible=icon]:block"
              />
            </>
          ) : (
            <>
              <MercattoLogo className="h-7 w-auto group-data-[collapsible=icon]:hidden" />
              <MercattoIcon className="hidden size-7 shrink-0 group-data-[collapsible=icon]:block" />
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ name, href, Icon, exact, match }) => {
                const active = exact
                  ? path === href
                  : (match ?? [href]).some((m) => path === m || path.startsWith(`${m}/`));
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={name}>
                      <LocalizedClientLink href={href}>
                        <Icon />
                        <span>{name}</span>
                      </LocalizedClientLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: usuario logueado */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {userInitials}
                  </span>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium text-sidebar-foreground">
                      {userName || "Usuario"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <LocalizedClientLink href="/b2b/perfil">
                    <UserRound className="mr-2 size-4" />
                    Mi perfil
                  </LocalizedClientLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggle(); }}>
                  {dark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                  {dark ? "Modo claro" : "Modo oscuro"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <MinimalartAttribution className="mt-1 py-1 group-data-[collapsible=icon]:hidden" />
      </SidebarFooter>
    </Sidebar>
  );
}
