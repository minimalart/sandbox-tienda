import { EllipsisHorizontal } from '@medusajs/icons';
import {
  Button,
  Container,
  Heading,
  Text,
  Switch,
  Input,
  Label,
  Select,
  Textarea,
  Drawer,
  DataTable,
  createDataTableColumnHelper,
  useDataTable,
  DropdownMenu,
  IconButton,
  toast,
} from '@medusajs/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSettings, useUpdateAppSettings } from '../../../../hooks/api/app-settings';
import { useActiveSite } from '../../../../hooks/use-active-site';
import { SiteScopeBar } from '../../../../components/common/site-scope-bar';
import { findDescriptor, findNamespace } from '../../../../../modules/app-settings/descriptors';
import { usePrivacyTranslation } from '../i18n';

type Category = {
  enabled: boolean;
  name: { en: string; es: string };
  description: { en: string; es: string };
};
type Consent = {
  enabled: boolean;
  mode: string;
  showRejectAll: boolean;
  showPreferences: boolean;
  consentRevision: number;
  localeMode: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  categories: Record<string, Category>;
};
type Analytics = { enabled: boolean; measurementId: string; consentCategory: string };
type Row = Category & { id: string };
const helper = createDataTableColumnHelper<Row>();
const emptyAnalytics: Analytics = {
  enabled: false,
  measurementId: '',
  consentCategory: 'analytics',
};

export default function SettingsScreen({
  section,
}: {
  section: 'privacy';
}) {
  const { activeId, isPending } = useActiveSite();
  const { t } = usePrivacyTranslation();
  if (isPending)
    return (
      <Container>
        <Text>{t('loading')}</Text>
      </Container>
    );
  return (
    <>
      <SiteScopeBar screen="marketing-privacy" reloadOnChange={false} allowInstance />
      <ScopedSettings
        key={activeId ? `${activeId}:${section}` : `global:${section}`}
        siteId={activeId}
        section={section}
      />
    </>
  );
}

function ScopedSettings({
  siteId,
  section,
}: {
  siteId: string | null;
  section: 'privacy';
}) {
  const { t, lang } = usePrivacyTranslation();
  const query = useAppSettings(undefined, siteId);
  const mutation = useUpdateAppSettings(siteId);
  const [editing, setEditing] = useState<'consent' | null>(null);
  const [consentDraft, setConsentDraft] = useState<Consent | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<Row | null>(null);
  const getValue = (namespace: string, key: string) =>
    query.data?.settings.find((s) => s.namespace === namespace && s.key === key)?.value;
  const consentInstalled = Boolean(findNamespace('extension:consent-management'));
  const analyticsInstalled = Boolean(findNamespace('extension:ga4'));
  const defaults = findDescriptor('extension:consent-management', 'CONFIG')?.default as
    | Consent
    | undefined;
  const consent = (getValue('extension:consent-management', 'CONFIG') ?? defaults) as
    | Consent
    | undefined;
  const analyticsValue = getValue('extension:ga4', 'STOREFRONT_CONFIG') as Analytics | undefined;
  const analytics = analyticsValue ?? emptyAnalytics;
  const clarity = getValue('extension:clarity', 'CONFIG') as { enabled?: boolean } | undefined;
  const servicesFor = (category: string) =>
    [
      analyticsInstalled && analytics.enabled && category === analytics.consentCategory
        ? 'Google Analytics 4'
        : '',
      findNamespace('extension:clarity') && clarity?.enabled && category === 'analytics'
        ? 'Microsoft Clarity'
        : '',
    ]
      .filter(Boolean)
      .join(', ') || '—';
  const save = async (namespace: string, key: string, value: unknown) => {
    try {
      await mutation.mutateAsync({ namespace, values: { [key]: value } });
      toast.success(t('saved'));
      setEditing(null);
      setCategoryDraft(null);
    } catch {
      toast.error(t('failed'));
    }
  };
  const editConsent = () => {
    if (consent) {
      setConsentDraft(structuredClone(consent));
      setEditing('consent');
    }
  };
  const categoryRows: Row[] = Object.entries(consent?.categories ?? {}).map(([id, c]) => ({
    id,
    ...c,
  }));
  const columns = [
    helper.accessor('id', { header: t('category'), cell: ({ row }) => row.original.name[lang] }),
    helper.display({
      id: 'required',
      header: t('required'),
      cell: ({ row }) => t(row.original.id === 'necessary' ? 'yes' : 'no'),
    }),
    helper.display({
      id: 'services',
      header: t('services'),
      cell: ({ row }) => servicesFor(row.original.id),
    }),
    helper.display({
      id: 'status',
      header: t('status'),
      cell: ({ row }) => t(row.original.enabled ? 'active' : 'inactive'),
    }),
    helper.display({
      id: 'actions',
      header: t('actions'),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton variant="transparent" aria-label={t('actions')}>
              <EllipsisHorizontal />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => setCategoryDraft(structuredClone(row.original))}>
              {t('edit')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      ),
    }),
  ];
  const table = useDataTable({
    columns,
    data: categoryRows,
    getRowId: (row) => row.id,
    rowCount: categoryRows.length,
  });
  if (query.isPending)
    return (
      <Container>
        <Text>{t('loading')}</Text>
      </Container>
    );
  if (query.isError)
    return (
      <Container>
        <Text>{t('error')}</Text>
        <Button onClick={() => query.refetch()}>{t('manage')}</Button>
      </Container>
    );
  const title = section;
  return (
    <div className="flex flex-col gap-4">
      <Container>
        <Heading>{t(title)}</Heading>
        {(
          <Link to="/marketing-privacy" className="text-ui-fg-interactive">
            {t('title')}
          </Link>
        )}
      </Container>
      {section === 'privacy' &&
        (consentInstalled ? (
          <>
            <Container className="flex flex-col gap-3">
              <Text>{t(consent?.enabled ? 'active' : 'inactive')}</Text>
              <Text>
                {t('mode')}: {t((consent?.mode ?? 'opt-in') as 'opt-in')}
              </Text>
              <Button variant="secondary" onClick={editConsent}>
                {t('edit')}
              </Button>
            </Container>
            <Container className="p-0">
              <DataTable instance={table}>
                <DataTable.Table />
              </DataTable>
            </Container>
          </>
        ) : (
          <Container>{t('unavailable')}</Container>
        ))}
      <Drawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setEditing(null);
        }}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t('privacy')}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            {editing === 'consent' && consentDraft && (
              <>
                <Label>
                  {t('enabled')}
                  <Switch
                    checked={consentDraft.enabled}
                    onCheckedChange={(enabled) => setConsentDraft({ ...consentDraft, enabled })}
                  />
                </Label>
                <Label>
                  {t('mode')}
                  <Select
                    value={consentDraft.mode}
                    onValueChange={(mode) => setConsentDraft({ ...consentDraft, mode })}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {(['opt-in', 'opt-out', 'informational'] as const).map((mode) => (
                        <Select.Item value={mode} key={mode}>
                          {t(mode)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Label>
                <Label>
                  {t('reject')}
                  <Switch
                    checked={consentDraft.showRejectAll}
                    onCheckedChange={(showRejectAll) =>
                      setConsentDraft({ ...consentDraft, showRejectAll })
                    }
                  />
                </Label>
                <Label>
                  {t('preferences')}
                  <Switch
                    checked={consentDraft.showPreferences}
                    onCheckedChange={(showPreferences) =>
                      setConsentDraft({ ...consentDraft, showPreferences })
                    }
                  />
                </Label>
                <Label>
                  {t('revision')}
                  <Input
                    type="number"
                    min={1}
                    value={consentDraft.consentRevision}
                    onChange={(e) =>
                      setConsentDraft({ ...consentDraft, consentRevision: Number(e.target.value) })
                    }
                  />
                </Label>
                <Text size="small">{t('revisionHelp')}</Text>
                <Label>
                  {t('privacyUrl')}
                  <Input
                    value={consentDraft.privacyPolicyUrl ?? ''}
                    onChange={(e) =>
                      setConsentDraft({ ...consentDraft, privacyPolicyUrl: e.target.value })
                    }
                  />
                </Label>
                <Label>
                  {t('cookieUrl')}
                  <Input
                    value={consentDraft.cookiePolicyUrl ?? ''}
                    onChange={(e) =>
                      setConsentDraft({ ...consentDraft, cookiePolicyUrl: e.target.value })
                    }
                  />
                </Label>
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setEditing(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              isLoading={mutation.isPending}
              onClick={() =>
                save('extension:consent-management', 'CONFIG', consentDraft)
              }
            >
              {t('save')}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
      <Drawer
        open={categoryDraft !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setCategoryDraft(null);
        }}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{categoryDraft?.name[lang]}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            {categoryDraft && (
              <>
                <Label>
                  {t('enabled')}
                  <Switch
                    disabled={categoryDraft.id === 'necessary'}
                    checked={categoryDraft.enabled}
                    onCheckedChange={(enabled) => setCategoryDraft({ ...categoryDraft, enabled })}
                  />
                </Label>
                {(['en', 'es'] as const).map((l) => (
                  <div key={l} className="flex flex-col gap-3">
                    <Label>
                      {t(l === 'en' ? 'nameEn' : 'nameEs')}
                      <Input
                        value={categoryDraft.name[l]}
                        onChange={(e) =>
                          setCategoryDraft({
                            ...categoryDraft,
                            name: { ...categoryDraft.name, [l]: e.target.value },
                          })
                        }
                      />
                    </Label>
                    <Label>
                      {t(l === 'en' ? 'descriptionEn' : 'descriptionEs')}
                      <Textarea
                        value={categoryDraft.description[l]}
                        onChange={(e) =>
                          setCategoryDraft({
                            ...categoryDraft,
                            description: { ...categoryDraft.description, [l]: e.target.value },
                          })
                        }
                      />
                    </Label>
                  </div>
                ))}
                <Text>
                  {t('services')}: {servicesFor(categoryDraft.id)}
                </Text>
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setCategoryDraft(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              isLoading={mutation.isPending}
              onClick={() => {
                if (!consent || !categoryDraft) return;
                const { id, ...category } = categoryDraft;
                save('extension:consent-management', 'CONFIG', {
                  ...consent,
                  consentRevision: consent.consentRevision + 1,
                  categories: { ...consent.categories, [id]: category },
                });
              }}
            >
              {t('save')}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  );
}
