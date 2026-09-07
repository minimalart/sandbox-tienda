import { Badge, Label, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { renderWhatsAppPreview } from '../../../lib/whatsapp-format';
import { registerWhatsappTranslations } from '../../../translations/whatsapp';

/** Placeholders {{n}} únicos detectados en el body, en orden. */
function detectedPlaceholders(text: string): number[] {
  const matches = text.match(/\{\{\s*\d+\s*\}\}/g) ?? [];
  const nums = matches.map((m) => Number(m.replace(/\D/g, '')));
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

/**
 * Vista previa reutilizable del cuerpo de un template de WhatsApp: burbuja verde
 * de chat (con formato propio de WhatsApp renderizado y ejemplos sustituidos por
 * `{{n}}`) + lista de variables detectadas. La usa el `<aside>` del modal.
 */
export const WhatsAppTemplatePreview = ({
  value,
  examples,
}: {
  value: string;
  examples?: string[];
}) => {
  const { t, i18n } = useTranslation('whatsapp');
  registerWhatsappTranslations(i18n);

  const placeholders = detectedPlaceholders(value);

  return (
    <div className="flex flex-col gap-2">
      <Label className="font-semibold text-ui-fg-base">{t('PREVIEW_TITLE')}</Label>

      {value.trim() ? (
        <>
          {/* Fondo tipo chat de WhatsApp; la burbuja siempre es verde clara
              (mensaje enviado), independiente del tema del admin, para que se vea
              como el mensaje real que recibe el cliente. */}
          <div className="rounded-xl bg-[#e5ddd5] p-4">
            <div className="relative ml-auto max-w-[92%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[#d9fdd3] px-2.5 pb-4 pt-1.5 text-[13px] leading-[1.35] text-[#111b21] shadow-sm">
              {renderWhatsAppPreview(value, { examples })}
              <span className="pointer-events-none absolute bottom-1 right-2 select-none text-[10px] leading-none text-[#54656f]">
                12:00
              </span>
            </div>
          </div>

          {placeholders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Text size="xsmall" className="uppercase text-ui-fg-muted">
                {t('PREVIEW_VARIABLES')}
              </Text>
              <div className="flex flex-col gap-1">
                {placeholders.map((n) => {
                  const example = examples?.[n - 1]?.trim();
                  return (
                    <div key={n} className="flex min-w-0 items-center gap-2">
                      <Badge size="2xsmall" className="shrink-0 font-mono">
                        {`{{${n}}}`}
                      </Badge>
                      {example ? (
                        <Text
                          size="small"
                          className="truncate text-ui-fg-subtle"
                          title={example}
                        >
                          {example}
                        </Text>
                      ) : (
                        <Text size="small" className="italic text-ui-fg-muted">
                          {t('PREVIEW_VAR_EMPTY')}
                        </Text>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}

      <Text size="xsmall" className="text-ui-fg-muted">
        {t('PREVIEW_HINT', { token: '{{n}}' })}
      </Text>
    </div>
  );
};
