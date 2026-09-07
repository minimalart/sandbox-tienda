import { listB2BOrders } from "@lib/data/b2b-cart";
import { getMyCompany } from "@lib/data/company";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@modules/b2b/components/portal/page-header";
import SectionCards, { type StatCard } from "@modules/b2b/components/portal/section-cards";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Plus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portal B2B" };

const fmtDate = (iso?: string | Date) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

const CARDS = [
  {
    name: "Pedidos",
    desc: "Creá nuevos pedidos por SKU o lista, y revisá los anteriores.",
    href: "/b2b/pedidos",
    Icon: ClipboardList,
  },
  {
    name: "Mi empresa",
    desc: "Datos de la empresa y gestión de usuarios.",
    href: "/b2b/empresa",
    Icon: Building2,
  },
];

export default async function B2BHome() {
  const [my, orders] = await Promise.all([
    getMyCompany(),
    listB2BOrders(50).catch(() => []),
  ]);
  const members = my.members ?? [];
  const lastOrder = orders[0];

  const stats: StatCard[] = [
    {
      label: "Pedidos",
      value: orders.length,
      hint: lastOrder ? `Último: ${fmtDate(lastOrder.created_at)}` : "Sin pedidos aún",
      Icon: ClipboardList,
    },
    {
      label: "Usuarios",
      value: members.length,
      hint: "En tu empresa",
      Icon: Users,
    },
    {
      label: "Estado",
      value: my.company?.status === "active" ? "Activa" : my.company?.status ?? "—",
      hint: "Cuenta mayorista",
      Icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal Mayorista"
        description="Comprá a nombre de tu empresa con precios mayoristas."
        actions={
          <Button asChild>
            <LocalizedClientLink href="/b2b/pedidos/nuevo">
              <Plus className="size-4" />
              Nuevo pedido
            </LocalizedClientLink>
          </Button>
        }
      />

      <SectionCards items={stats} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map(({ name, desc, href, Icon }) => (
          <LocalizedClientLink key={href} href={href} className="group">
            <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex h-full items-start gap-4 p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </LocalizedClientLink>
        ))}
      </div>
    </div>
  );
}
