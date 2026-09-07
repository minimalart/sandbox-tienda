"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reorder } from "@lib/data/company";
import { useDemoHref } from "@lib/site-config/context";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { Eye, Loader2, MoreHorizontal, RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  company: { id: string; name: string };
  placedBy: { id: string; email: string };
};

/**
 * Acciones de una fila de Pedidos (⋯): Ver detalle + Volver a pedir.
 * El reorder agrega al carrito B2B (/api/b2b/cart) y lleva al checkout mayorista
 * — NO al carrito B2C.
 */
export default function OrderRowActions({ orderId, company, placedBy }: Props) {
  const { countryCode } = useParams() as { countryCode: string };
  const demoHref = useDemoHref();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onReorder = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await reorder(orderId);
      const lines = r.resolved.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity }));
      if (!lines.length) {
        setErr("No se pudieron resolver los ítems del pedido.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/b2b/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          countryCode,
          lines,
          company: {
            id: company.id,
            name: company.name,
            placed_by_id: placedBy.id,
            placed_by_email: placedBy.email,
          },
        }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
      if (!data.ok) {
        setErr(data.error ?? "No se pudo agregar al carrito.");
        setBusy(false);
        return;
      }
      // Navegación dura a la URL limpia (igual que finalize del order builder).
      window.location.assign(demoHref("/b2b/checkout"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo volver a pedir.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Acciones del pedido"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <LocalizedClientLink href={`/b2b/pedidos/${orderId}`}>
              <Eye className="mr-2 size-4" />
              Ver detalle
            </LocalizedClientLink>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); onReorder(); }}>
            <RotateCcw className="mr-2 size-4" />
            Volver a pedir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {err ? <span className="max-w-[12rem] text-right text-xs text-destructive">{err}</span> : null}
    </div>
  );
}
