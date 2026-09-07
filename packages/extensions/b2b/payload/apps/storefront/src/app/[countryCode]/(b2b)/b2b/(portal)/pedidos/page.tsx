import { listB2BOrders } from "@lib/data/b2b-cart";
import { getMyCompany } from "@lib/data/company";
import { retrieveCustomer } from "@lib/data/customer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import OrderRowActions from "@modules/b2b/components/order-row-actions";
import PageHeader from "@modules/b2b/components/portal/page-header";
import { getB2BOrderStatus } from "@modules/b2b/lib/order-status";
import { Button } from "@/components/ui/button";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pedidos | Mayorista" };

const fmtDate = (iso?: string | Date) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

export default async function PedidosPage() {
  const [customer, my, orders] = await Promise.all([
    retrieveCustomer().catch(() => null),
    getMyCompany(),
    listB2BOrders(50).catch(() => []),
  ]);
  const company = { id: my.company?.id ?? "", name: my.company?.name ?? "" };
  const placedBy = { id: customer?.id ?? "", email: customer?.email ?? "" };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pedidos"
        description="Creá nuevos pedidos y revisá los anteriores."
        actions={
          <Button asChild>
            <LocalizedClientLink href="/b2b/pedidos/nuevo">
              <Plus className="size-4" />
              Nuevo pedido
            </LocalizedClientLink>
          </Button>
        }
      />

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Todavía no tenés pedidos.</p>
            <Button asChild size="sm">
              <LocalizedClientLink href="/b2b/pedidos/nuevo">
                <Plus className="size-4" />
                Crear tu primer pedido
              </LocalizedClientLink>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const st = getB2BOrderStatus(o);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium text-foreground">
                      <LocalizedClientLink
                        href={`/b2b/pedidos/${o.id}`}
                        className="transition-colors hover:text-primary"
                      >
                        #{o.display_id ?? o.id.slice(-6)}
                      </LocalizedClientLink>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={st.className}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {o.total != null ? `$${Number(o.total).toLocaleString("es-AR")}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderRowActions orderId={o.id} company={company} placedBy={placedBy} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
