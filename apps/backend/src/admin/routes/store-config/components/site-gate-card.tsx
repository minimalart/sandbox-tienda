import { Button, Container, Heading, Input, Label, Switch, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type SiteGateSite, useSiteGates, useUpdateSiteGate } from '../../../hooks/api';

/** Mismo rango que valida el backend (modules/store-config/service.ts). */
const MIN_LENGTH = 4;
const MAX_LENGTH = 6;

type Draft = { enabled: boolean; password: string };

/**
 * "Acceso" en la pantalla Preferencias: la página de contraseña, sitio por sitio.
 *
 * Una fila por sitio: la tienda principal (setting `password_gate`) y cada demo
 * `ready` (columnas `password_gate_*` de su fila). A diferencia del resto de las
 * tarjetas —que guardan al togglear— acá hay texto libre, así que cada fila tiene
 * su propio botón Guardar y manda switch + contraseña juntos.
 */
export const SiteGateCard = () => {
  const { t } = useTranslation('storeConfig');
  const { data, isPending } = useSiteGates();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingScope, setSavingScope] = useState<string | null>(null);

  const sites = data?.sites ?? [];

  // Cada respuesta del server pisa el borrador: es la verdad de lo guardado
  // (el backend puede haber apagado un gate sin clave usable).
  useEffect(() => {
    if (!data?.sites) return;
    setDrafts(
      Object.fromEntries(
        data.sites.map((site) => [site.scope, { enabled: site.enabled, password: site.password }])
      )
    );
  }, [data]);

  const { mutateAsync: save } = useUpdateSiteGate({
    onSuccess: () => toast.success(t('ACCESS_SAVED')),
    onError: (e) => toast.error(t('ACCESS_SAVE_ERROR', { msg: e.message })),
  });

  const draftFor = (site: SiteGateSite): Draft =>
    drafts[site.scope] ?? { enabled: site.enabled, password: site.password };

  const patch = (scope: string, next: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [scope]: { ...(prev[scope] ?? { enabled: false, password: '' }), ...next },
    }));

  const passwordIsValid = (password: string) =>
    password.length >= MIN_LENGTH && password.length <= MAX_LENGTH && !/\s/.test(password);

  const onSave = async (site: SiteGateSite) => {
    const draft = draftFor(site);
    setSavingScope(site.scope);
    try {
      // `password` se manda SÓLO si cambió. Reenviar la que ya estaba haría que el
      // backend la revalide con el tope actual, y una palabra guardada cuando el
      // máximo era más largo se borraría sola al mover el switch.
      await save({
        scope: site.scope,
        enabled: draft.enabled,
        ...(draft.password !== site.password ? { password: draft.password } : {}),
      });
    } finally {
      setSavingScope(null);
    }
  };

  return (
    // Sin `mb-4`: el espaciado lo pone el wrapper de la pestaña (ver
    // `branch-settings-card`, que también explica por qué esto sigue siendo un
    // `Container` con `p-0` + header propio y no una sección de la página).
    <Container className="p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t('ACCESS_TITLE')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('ACCESS_DESCRIPTION')}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {t('ACCESS_UNLOCK_HINT')}
        </Text>
      </div>

      <div className="flex flex-col gap-6 px-6 pb-6">
        {!isPending && sites.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            {t('ACCESS_EMPTY')}
          </Text>
        )}

        {sites.map((site) => {
          const draft = draftFor(site);
          const changedPassword = draft.password !== site.password;
          const valid = passwordIsValid(draft.password);
          // Una palabra guardada cuando el máximo era más largo sigue sirviendo: el
          // backend la acepta al leer, así que el switch tiene que seguir usable (si no,
          // no se podría ni apagar el gate de ese sitio). Sólo se exige el rango nuevo
          // cuando se escribe una palabra distinta.
          const usable = valid || (!changedPassword && site.password !== '');
          const dirty = draft.enabled !== site.enabled || changedPassword;
          const saving = savingScope === site.scope;
          // Corta y con espacios caen en el mismo mensaje (el del rango); demasiado
          // larga tiene el suyo porque es el caso de las palabras viejas.
          const hint =
            draft.password === ''
              ? t('ACCESS_NO_PASSWORD')
              : draft.password.length > MAX_LENGTH
                ? t('ACCESS_TOO_LONG', { max: MAX_LENGTH })
                : t('ACCESS_PASSWORD_HELP', { min: MIN_LENGTH, max: MAX_LENGTH });

          return (
            <div
              key={site.scope}
              className="flex flex-col gap-4 rounded-lg border border-ui-border-base p-4 md:flex-row md:items-end md:justify-between"
            >
              <div className="flex flex-col gap-1 md:pr-4">
                <Label>{site.scope === 'store' ? t('ACCESS_MAIN_STORE') : site.label}</Label>
                <Text size="small" className="text-ui-fg-muted">
                  {site.path}
                </Text>
              </div>

              <div className="flex flex-col gap-1 md:w-72">
                <Label htmlFor={`gate-password-${site.scope}`} size="small">
                  {t('ACCESS_COLUMN_PASSWORD')}
                </Label>
                <Input
                  id={`gate-password-${site.scope}`}
                  value={draft.password}
                  autoComplete="off"
                  placeholder={t('ACCESS_PASSWORD_PLACEHOLDER')}
                  maxLength={MAX_LENGTH}
                  onChange={(e) => patch(site.scope, { password: e.target.value.trim() })}
                  disabled={isPending || saving}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t('ACCESS_PASSWORD_HELP', { min: MIN_LENGTH, max: MAX_LENGTH })}
                </Text>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-start gap-1">
                  <Label htmlFor={`gate-enabled-${site.scope}`} size="small">
                    {t('ACCESS_ENABLED_LABEL')}
                  </Label>
                  <Switch
                    id={`gate-enabled-${site.scope}`}
                    checked={draft.enabled}
                    onCheckedChange={(v) => patch(site.scope, { enabled: v })}
                    disabled={isPending || saving || !usable}
                  />
                  {!usable && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {hint}
                    </Text>
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => onSave(site)}
                  disabled={
                    isPending ||
                    saving ||
                    !dirty ||
                    (changedPassword && draft.password !== '' && !valid) ||
                    (draft.enabled && !usable)
                  }
                  isLoading={saving}
                >
                  {t('ACCESS_SAVE')}
                </Button>
              </div>
            </div>
          );
        })}

        <Text size="xsmall" className="text-ui-fg-muted">
          {t('ACCESS_PROPAGATION_HINT')}
        </Text>
      </div>
    </Container>
  );
};
