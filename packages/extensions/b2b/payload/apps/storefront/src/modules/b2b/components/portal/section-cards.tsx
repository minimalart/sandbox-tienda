import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export type StatCard = {
  label: string;
  value: string | number;
  hint?: string;
  Icon?: LucideIcon;
};

/** Fila de tarjetas de métricas, estilo dashboard-01 (shadcn). */
export default function SectionCards({ items }: { items: StatCard[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, hint, Icon }) => (
        <Card key={label}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-foreground">{value}</div>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
