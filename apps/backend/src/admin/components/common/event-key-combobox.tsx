import { ChevronDownMini } from '@medusajs/icons';
import { clx } from '@medusajs/ui';
import { useRef, useState } from 'react';
import { EMAIL_TEMPLATE_KEY_OPTIONS } from '../../lib/email-events-catalog';

/**
 * Searchable single-select for a template `key`. Sources options from the
 * events catalog (no app/medusa split). The trigger is styled to match a
 * @medusajs/ui Select.Trigger (bg-ui-bg-field, shadow-borders-base, focus ring,
 * chevron on the right). Keyboard nav: ArrowDown/ArrowUp move through the
 * filtered list, Enter/Space confirms, Escape closes.
 */
export function EventKeyCombobox({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = EMAIL_TEMPLATE_KEY_OPTIONS.find(
    (o) => o.value === value,
  );

  // When closed the trigger shows the selected label; when open it shows a
  // live search input over the same field area.
  const q = query.trim().toLowerCase();
  const filtered = q
    ? EMAIL_TEMPLATE_KEY_OPTIONS.filter(
        (o) =>
          o.value.toLowerCase().includes(q) ||
          o.label.toLowerCase().includes(q) ||
          o.group.toLowerCase().includes(q),
      )
    : EMAIL_TEMPLATE_KEY_OPTIONS;

  const openDropdown = () => {
    if (disabled) return;
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

  // Group consecutive options together for the dropdown rendering.
  const groups: Array<{ label: string; options: typeof filtered }> = [];
  for (const opt of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.label === opt.group) {
      last.options.push(opt);
    } else {
      groups.push({ label: opt.group, options: [opt] });
    }
  }

  const globalIdx = (groupIdx: number, optIdx: number) => {
    let idx = 0;
    for (let g = 0; g < groupIdx; g++) {
      idx += groups[g].options.length;
    }
    return idx + optIdx;
  };

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger — matches Select.Trigger look */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={open ? closeDropdown : openDropdown}
        className={clx(
          'flex h-8 w-full items-center justify-between gap-x-2 rounded-md px-2 py-1.5',
          'bg-ui-bg-field shadow-borders-base',
          'text-ui-fg-base text-sm',
          'outline-none transition-shadow',
          'focus-visible:shadow-borders-interactive-with-active',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          open && 'shadow-borders-interactive-with-active',
        )}
        data-disabled={disabled || undefined}
      >
        {open ? (
          // When open: replace label area with a live search input.
          <input
            ref={inputRef}
            value={query}
            placeholder="Buscar…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ui-fg-muted"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            // Prevent the button click handler from toggling closed when typing.
            onClick={(e) => e.stopPropagation()}
            onBlur={() => window.setTimeout(closeDropdown, 150)}
          />
        ) : (
          <span
            className={clx(
              'min-w-0 flex-1 truncate text-left',
              !selectedOption && 'text-ui-fg-muted',
            )}
          >
            {selectedOption ? selectedOption.label : (placeholder ?? 'Seleccioná una clave')}
          </span>
        )}
        <ChevronDownMini
          className={clx(
            'shrink-0 text-ui-fg-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* When a value is selected and the field is closed, show the raw key
          as muted monospace underneath the trigger. */}
      {!open && value && (
        <span className="mt-0.5 block font-mono text-ui-fg-muted text-xs">
          {value}
        </span>
      )}

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-ui-fg-muted text-sm">
              Sin resultados
            </div>
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
                      isSelected && 'text-ui-fg-interactive',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(opt.value);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="truncate text-ui-fg-base">{opt.label}</span>
                    <span className="shrink-0 font-mono text-ui-fg-muted text-xs">
                      {opt.value}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventKeyCombobox;
