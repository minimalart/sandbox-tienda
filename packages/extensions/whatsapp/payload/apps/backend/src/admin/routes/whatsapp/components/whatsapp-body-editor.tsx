import { IconButton, Label, Text, Textarea, Tooltip } from '@medusajs/ui';
import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { wrapSelection, type WhatsAppMark } from '../../../lib/whatsapp-format';
import { registerWhatsappTranslations } from '../../../translations/whatsapp';

type ToolbarItem = { mark: WhatsAppMark; label: string; hintKey: string; className: string };

// Botones del toolbar. Usamos glifos con estilo en vez de íconos porque el
// formato de WhatsApp no tiene equivalentes en @medusajs/icons.
const TOOLBAR: ToolbarItem[] = [
  { mark: 'bold', label: 'B', hintKey: 'TOOLBAR_BOLD', className: 'font-bold' },
  { mark: 'italic', label: 'I', hintKey: 'TOOLBAR_ITALIC', className: 'italic' },
  { mark: 'strike', label: 'S', hintKey: 'TOOLBAR_STRIKE', className: 'line-through' },
  { mark: 'mono', label: '</>', hintKey: 'TOOLBAR_MONO', className: 'font-mono text-[0.7rem]' },
];

/**
 * Campo del cuerpo del template con toolbar de formato WhatsApp. El body se
 * guarda en texto plano (con los marcadores propios de WhatsApp) — el toolbar
 * solo inserta esos marcadores por comodidad. La vista previa vive fuera de este
 * componente (ver WhatsAppTemplatePreview, en el aside del modal).
 */
export const WhatsAppBodyEditor = ({
  value,
  onChange,
  disabled,
  placeholderCount,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholderCount: number;
}) => {
  const { t, i18n } = useTranslation('whatsapp');
  registerWhatsappTranslations(i18n);

  const ref = useRef<HTMLTextAreaElement>(null);
  // Rango a re-seleccionar tras aplicar formato, aplicado después del re-render.
  const pendingSel = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const sel = pendingSel.current;
    const el = ref.current;
    if (sel && el) {
      el.focus();
      el.setSelectionRange(sel.start, sel.end);
      pendingSel.current = null;
    }
  }, [value]);

  const applyMark = (mark: WhatsAppMark) => {
    const el = ref.current;
    if (!el) return;
    const { next, selStart, selEnd } = wrapSelection(el, value, mark);
    pendingSel.current = { start: selStart, end: selEnd };
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label size="small">{t('FIELD_BODY')}</Label>
        <div className="flex items-center gap-1">
          {TOOLBAR.map((item) => {
            const hint = t(item.hintKey);
            return (
              <Tooltip key={item.mark} content={hint}>
                <IconButton
                  type="button"
                  size="small"
                  variant="transparent"
                  disabled={disabled}
                  onClick={() => applyMark(item.mark)}
                  aria-label={hint}
                >
                  <span className={item.className}>{item.label}</span>
                </IconButton>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={t('BODY_PLACEHOLDER', { p1: '{{1}}', p2: '{{2}}', p3: '{{3}}' })}
        disabled={disabled}
      />

      <Text size="small" className="text-ui-fg-subtle">
        {t('BODY_HINT', { count: placeholderCount, tokens: '{{1}}, {{2}}…' })}
      </Text>
    </div>
  );
};
