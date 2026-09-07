import { ChevronDownMini } from '@medusajs/icons';
import { clx } from '@medusajs/ui';
import { useMemo, useRef, useState } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  group: string;
}

interface EventComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  id?: string;
}

/**
 * Single-select CON BUSCADOR VISIBLE, agrupado por categoría. Reemplaza al
 * Select de Radix (que tiene typeahead pero no muestra lo que se escribe). Al
 * abrir, el área del trigger se vuelve un input de búsqueda en vivo que filtra
 * por label, value y grupo. Estilado como un Select.Trigger de @medusajs/ui.
 */
export const EventCombobox = ({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  id,
}: EventComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? options.filter(
            (o) =>
              o.label.toLowerCase().includes(q) ||
              o.value.toLowerCase().includes(q) ||
              o.group.toLowerCase().includes(q)
          )
        : options,
    [options, q]
  );

  const openDropdown = () => {
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
    setActiveIdx(0);
  };

  const select = (val: string) => {
    onChange(val);
    closeDropdown();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) select(opt.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  };

  // Agrupar opciones consecutivas por grupo, respetando el orden recibido.
  const groups: Array<{ label: string; options: ComboboxOption[] }> = [];
  for (const opt of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.label === opt.group) last.options.push(opt);
    else groups.push({ label: opt.group, options: [opt] });
  }

  const globalIdx = (groupIdx: number, optIdx: number) => {
    let idx = 0;
    for (let g = 0; g < groupIdx; g++) idx += groups[g].options.length;
    return idx + optIdx;
  };

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={open ? closeDropdown : openDropdown}
        className={clx(
          'flex h-8 w-full items-center justify-between gap-x-2 rounded-md px-2 py-1.5',
          'bg-ui-bg-field shadow-borders-base',
          'text-ui-fg-base text-sm outline-none transition-shadow',
          'focus-visible:shadow-borders-interactive-with-active',
          open && 'shadow-borders-interactive-with-active'
        )}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            placeholder={searchPlaceholder ?? 'Buscar…'}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ui-fg-muted"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => window.setTimeout(closeDropdown, 150)}
          />
        ) : (
          <span
            className={clx('min-w-0 flex-1 truncate text-left', !selected && 'text-ui-fg-muted')}
          >
            {selected ? selected.label : (placeholder ?? '')}
          </span>
        )}
        <ChevronDownMini
          className={clx('shrink-0 text-ui-fg-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-ui-fg-muted text-sm">{emptyLabel ?? 'Sin resultados'}</div>
          )}
          {groups.map((group, gi) => (
            <div key={group.label}>
              <div className="bg-ui-bg-subtle px-3 py-1 font-medium text-ui-fg-muted text-xs uppercase tracking-wide">
                {group.label}
              </div>
              {group.options.map((opt, oi) => {
                const idx = globalIdx(gi, oi);
                const isActive = idx === activeIdx;
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={clx(
                      'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm',
                      isActive && 'bg-ui-bg-base-hover',
                      isSelected && 'text-ui-fg-interactive'
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(opt.value);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="truncate text-ui-fg-base">{opt.label}</span>
                    <span className="shrink-0 font-mono text-ui-fg-muted text-xs">{opt.value}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
