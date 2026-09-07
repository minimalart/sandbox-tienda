import { Button, FocusModal, Hint, Input, Label, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmailTemplate } from '../../../../hooks/api/email-templates';
import { useTestSendEmailTemplate } from '../../../../hooks/api/email-templates';
import { useEmailBranding } from '../../../../hooks/api/email-branding';
import {
  isDualAudience,
  getEventTemplatesForKey,
} from '../../../../lib/email-events-catalog';
import { fetchJson } from '../../../../lib/http';

/**
 * Low-level fire-and-forget test send. Returns success/error info so the
 * caller can report per-recipient results without aborting on first failure.
 *
 * Va por el `fetchJson` compartido y no por un `fetch` propio: la ruta está declarada
 * `scoped` y su handler llama a `assertIdInSite`, que sin `x-site-id` hace `return` en
 * la primera línea. O sea, el envío de prueba de la fila hermana salía sin filtro —
 * mandando un mail A UNA DIRECCIÓN REAL con el contenido de la plantilla de otra
 * tienda, que es el daño que ese guard existe para evitar y no estaba evitando.
 *
 * `fetchJson` y no `siteHeaders()` a mano porque la respuesta SÍ es JSON
 * (`{ sent, to }`): parsearla y descartarla es gratis, y de paso desaparece la copia
 * número 23 del helper. Esta copia además venía sin `credentials: 'include'` —
 * el hermano `useTestSendEmailTemplate` ya lo mandaba, así que eran dos transportes
 * distintos para la MISMA ruta según qué fila se probara.
 *
 * Lo que ve el operador si el guard dispara: el toast por destinatario pasa a decir
 * "Fallo → Admin (...): No encontrado." en vez de mandar el mail. Sólo puede pasar con
 * una fila hermana de otra tienda, y esas ya no llegan: `siblingRowIds` sale del
 * listado, que también viaja por `lib/http`.
 */
async function sendTest(
  id: string,
  to: string,
  data: Record<string, unknown>,
): Promise<void> {
  await fetchJson<{ sent: boolean; to: string }>(
    `/admin/email-templates/${id}/test-send`,
    { method: 'POST', body: JSON.stringify({ to, data }) },
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate;
  /** Sibling template rows resolved by the parent (keyed by catalog key). */
  siblingRowIds: Record<string, string>;
  sampleData: Record<string, unknown>;
}

/**
 * Test-send modal using FocusModal. Replaces the window.prompt approach.
 *
 * - Single-audience template: one email input.
 * - Dual-audience template: two email inputs (admin + user), sends separately,
 *   reports success/failure per recipient so one failure doesn't mask the other.
 */
export function TestSendModal({
  open,
  onOpenChange,
  template,
  siblingRowIds,
  sampleData,
}: Props) {
  const { t } = useTranslation('emailTemplates');
  const dual = isDualAudience(template.key);
  const siblings = getEventTemplatesForKey(template.key);

  const { data: brandingData } = useEmailBranding();
  const adminDefaultEmail =
    brandingData?.email_branding?.admin_notification_email ?? '';

  const testSendThis = useTestSendEmailTemplate(template.id);

  const [adminTo, setAdminTo] = useState('');
  const [userTo, setUserTo] = useState('');
  const [singleTo, setSingleTo] = useState('');
  const [sending, setSending] = useState(false);

  // Prefill admin email when branding loads.
  useEffect(() => {
    if (adminDefaultEmail && dual) setAdminTo(adminDefaultEmail);
  }, [adminDefaultEmail, dual]);

  const isPending = testSendThis.isPending || sending;

  const handleSend = async () => {
    if (!dual) {
      const to = singleTo.trim();
      if (!to) {
        toast.error(t('TEST_SEND_EMAIL_REQUIRED', { defaultValue: 'Ingresá un email.' }));
        return;
      }
      try {
        await testSendThis.mutateAsync({ to, data: sampleData });
        toast.success(t('TEST_SEND_SUCCESS', { to }));
        onOpenChange(false);
      } catch (e: any) {
        toast.error(t('ACTION_ERROR', { msg: e?.message ?? '' }));
      }
      return;
    }

    // Dual audience: resolve admin vs user row ids.
    const adminKey = siblings.find((s) => s.audience === 'admin')?.key;
    const userKey = siblings.find((s) => s.audience === 'user')?.key;
    const adminRowId =
      adminKey === template.key ? template.id : siblingRowIds[adminKey ?? ''];
    const userRowId =
      userKey === template.key ? template.id : siblingRowIds[userKey ?? ''];

    const adminToTrimmed = adminTo.trim();
    const userToTrimmed = userTo.trim();

    if (!adminToTrimmed && !userToTrimmed) {
      toast.error(
        t('TEST_SEND_EMAIL_REQUIRED', { defaultValue: 'Ingresá al menos un email.' }),
      );
      return;
    }

    setSending(true);
    try {
      const results: Array<{ label: string; ok: boolean; msg?: string }> = [];

      if (adminToTrimmed && adminRowId) {
        try {
          await sendTest(adminRowId, adminToTrimmed, sampleData);
          results.push({ label: `Admin (${adminToTrimmed})`, ok: true });
        } catch (e: any) {
          results.push({ label: `Admin (${adminToTrimmed})`, ok: false, msg: e?.message });
        }
      }

      if (userToTrimmed && userRowId) {
        try {
          await sendTest(userRowId, userToTrimmed, sampleData);
          results.push({ label: `Usuario (${userToTrimmed})`, ok: true });
        } catch (e: any) {
          results.push({ label: `Usuario (${userToTrimmed})`, ok: false, msg: e?.message });
        }
      }

      for (const r of results) {
        if (r.ok) {
          toast.success(`Email de prueba enviado → ${r.label}`);
        } else {
          toast.error(`Fallo → ${r.label}: ${r.msg ?? 'Error desconocido'}`);
        }
      }

      if (results.every((r) => r.ok)) onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  // ─── Helper: is a sibling row missing? ───────────────────────────────────────

  const adminKey = siblings.find((s) => s.audience === 'admin')?.key;
  const userKey = siblings.find((s) => s.audience === 'user')?.key;
  const adminRowMissing =
    dual && adminKey && adminKey !== template.key && !siblingRowIds[adminKey];
  const userRowMissing =
    dual && userKey && userKey !== template.key && !siblingRowIds[userKey];

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="max-w-md">
        <FocusModal.Header>
          <FocusModal.Title>{t('EDITOR_TEST_SEND')}</FocusModal.Title>
        </FocusModal.Header>

        <div className="flex flex-col gap-4 px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            {dual
              ? t('TEST_SEND_DUAL_HINT', {
                  defaultValue:
                    'Este evento notifica dos audiencias. Podés enviar la prueba a ambas o solo a una.',
                })
              : t('TEST_SEND_SINGLE_HINT', {
                  defaultValue: 'Ingresá el email al que querés enviar la prueba.',
                })}
          </Text>

          {dual ? (
            <>
              <div className="flex flex-col gap-1">
                <Label size="xsmall">
                  {t('TEST_SEND_ADMIN_EMAIL', { defaultValue: 'Email del admin' })}
                </Label>
                <Input
                  type="email"
                  value={adminTo}
                  onChange={(e) => setAdminTo(e.target.value)}
                  placeholder="admin@tienda.com"
                />
                {adminRowMissing && (
                  <Hint>
                    {t('TEST_SEND_SIBLING_MISSING', {
                      defaultValue:
                        'La plantilla admin no existe aún. Creala primero para enviar esta prueba.',
                    })}
                  </Hint>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label size="xsmall">
                  {t('TEST_SEND_USER_EMAIL', { defaultValue: 'Email del usuario' })}
                </Label>
                <Input
                  type="email"
                  value={userTo}
                  onChange={(e) => setUserTo(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                />
                {userRowMissing && (
                  <Hint>
                    {t('TEST_SEND_SIBLING_MISSING', {
                      defaultValue:
                        'La plantilla usuario no existe aún. Creala primero para enviar esta prueba.',
                    })}
                  </Hint>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <Label size="xsmall">
                {t('TEST_SEND_RECIPIENT', { defaultValue: 'Email del destinatario' })}
              </Label>
              <Input
                type="email"
                value={singleTo}
                onChange={(e) => setSingleTo(e.target.value)}
                placeholder="destinatario@ejemplo.com"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ui-border-base px-6 py-4">
          <Button
            variant="secondary"
            size="small"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('CANCEL')}
          </Button>
          <Button size="small" onClick={handleSend} isLoading={isPending}>
            {t('EDITOR_TEST_SEND')}
          </Button>
        </div>
      </FocusModal.Content>
    </FocusModal>
  );
}
