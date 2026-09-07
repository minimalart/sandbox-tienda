import type { DeliveryExecutionStatus } from "@lib/data/driver/types";

const STATUS_CONFIG: Record<
  DeliveryExecutionStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pendiente",
    className: "bg-gray-100 text-gray-700",
  },
  pickup: {
    label: "Retiro",
    className: "bg-amber-100 text-amber-700",
  },
  in_transit: {
    label: "En camino",
    className: "bg-blue-100 text-blue-700",
  },
  delivered: {
    label: "Entregado",
    className: "bg-green-100 text-green-700",
  },
  failed_attempt: {
    label: "Intento fallido",
    className: "bg-red-100 text-red-700",
  },
};

interface StatusBadgeProps {
  status: DeliveryExecutionStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${config.className}`}
    >
      {config.label}
    </span>
  );
}
