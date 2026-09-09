"use client";

import { presentationSummary } from "@lib/util/catalog-commercial";
import { getTracking } from "@lib/util/get-tracking";
import {
  handleImageError,
  PLACEHOLDER_IMAGE,
} from "@lib/util/placeholder-image";
import type { HttpTypes } from "@medusajs/types";
import OrderRowActions from "@modules/b2b/components/order-row-actions";
import { getB2BOrderStatus } from "@modules/b2b/lib/order-status";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  order: HttpTypes.StoreOrder;
  company: { id: string; name: string };
  placedBy: { id: string; email: string };
};

const fmt = (n?: number | null, currency?: string) =>
  `$${Math.round(Number(n ?? 0)).toLocaleString("es-AR")}${currency ? ` ${currency}` : ""}`;

const fmtDate = (iso?: string | Date) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

export default function B2BOrderDetail({ order, company, placedBy }: Props) {
  const st = getB2BOrderStatus(order);
  const currency = order.currency_code?.toUpperCase();
  const items = order.items ?? [];
  const addr = order.shipping_address;
  const tracking = getTracking(order);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        {/* Encabezado */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-lg font-semibold text-foreground">
                Pedido #{order.display_id ?? order.id.slice(-6)}
              </p>
              <p className="text-sm text-muted-foreground">Realizado el {fmtDate(order.created_at)}</p>
            </div>
            <Badge variant="outline" className={st.className}>{st.label}</Badge>
          </CardContent>
        </Card>

        {/* Ítems */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Productos ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 text-sm">
                <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.thumbnail || PLACEHOLDER_IMAGE} onError={handleImageError} alt={it.product_title ?? ""} className="size-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{it.product_title ?? it.title}</p>
                  {presentationSummary(it.metadata, it.quantity) && <p className="text-xs text-muted-foreground">{presentationSummary(it.metadata, it.quantity)}</p>}
                  <p className="text-xs text-muted-foreground">
                    {it.variant?.title ? `${it.variant.title} · ` : ""}{it.quantity} × {fmt(it.unit_price)}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums text-foreground">{fmt(it.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Dirección de envío */}
        {addr ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4 text-muted-foreground" /> Dirección de envío
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 text-sm text-muted-foreground">
              <p className="text-foreground">{addr.first_name} {addr.last_name}</p>
              {addr.company ? <p>{addr.company}</p> : null}
              <p>{addr.address_1}{addr.address_2 ? `, ${addr.address_2}` : ""}</p>
              <p>{addr.city}{addr.province ? `, ${addr.province}` : ""}{addr.postal_code ? ` (${addr.postal_code})` : ""}</p>
              {addr.phone ? <p>Tel: {addr.phone}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Tracking */}
        {tracking ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Seguimiento</CardTitle></CardHeader>
            <CardContent>
              <a
                href={tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                {tracking.number}
              </a>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Resumen */}
      <aside className="shrink-0 lg:w-80">
        <Card className="lg:sticky lg:top-6">
          <CardHeader className="pb-3"><CardTitle className="text-base">Resumen {currency ? `(${currency})` : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{fmt(order.subtotal)}</span></div>
            {order.discount_total > 0 ? (
              <div className="flex justify-between text-sm text-muted-foreground"><span>Descuento</span><span className="tabular-nums">- {fmt(order.discount_total)}</span></div>
            ) : null}
            <div className="flex justify-between text-sm text-muted-foreground"><span>Envío</span><span className="tabular-nums">{fmt(order.shipping_total)}</span></div>
            <div className="flex justify-between text-sm text-muted-foreground"><span>Impuestos</span><span className="tabular-nums">{fmt(order.tax_total)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-foreground"><span>Total</span><span className="tabular-nums">{fmt(order.total)}</span></div>
            <div className="flex justify-end pt-1">
              <OrderRowActions orderId={order.id} company={company} placedBy={placedBy} />
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
