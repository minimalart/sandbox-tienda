'use client';
export default function ProgressHeader({ assigned, total }: { assigned: number; total: number }) {
  const pending = Math.max(0, total - assigned);
  const percent = total ? Math.min(100, Math.round((assigned / total) * 100)) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Productos asignados</span>
        <span className="text-gray-600">{assigned} de {total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-[--primary-color] transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className={`text-xs ${pending ? 'text-amber-700' : 'text-emerald-700'}`}>
        {pending ? `${pending} ${pending === 1 ? 'unidad pendiente' : 'unidades pendientes'}` : 'Pedido completamente asignado'}
      </p>
    </div>
  );
}
