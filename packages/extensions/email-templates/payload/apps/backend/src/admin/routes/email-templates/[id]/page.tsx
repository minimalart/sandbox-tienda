import { Puck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { ArrowLeft, ChevronDown, ChevronUpMini } from '@medusajs/icons';
import {
  Badge,
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  StatusBadge,
  Tabs,
  Text,
  Textarea,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  type EmailTemplate,
  useEmailTemplate,
  useEmailTemplates,
  usePreviewEmailTemplate,
  usePublishEmailTemplate,
  useUnpublishEmailTemplate,
  useUpdateEmailTemplate,
} from '../../../hooks/api/email-templates';
import { emailPuckConfig } from '../../../lib/puck/email-config';
import { variablesForKey } from '../../../../modules/email/template-variables';
import { registerEmailTemplatesTranslations } from '../../../translations/email-templates';
import {
  getEventTemplatesForKey,
  isDualAudience,
  eventIdForKey,
} from '../../../lib/email-events-catalog';
import { TestSendModal } from './components/test-send-modal';
import { RealSendsPanel } from './components/real-sends-panel';

const EMPTY_DESIGN = { content: [], root: { props: {} } } as unknown as Data;

function htmlFallbackDesign(html: string): Data {
  return {
    root: { props: {} },
    content: html
      ? [{ type: 'RawHtml', props: { id: 'legacy-html', html } }]
      : [],
  } as unknown as Data;
}

// ─── Variables form ───────────────────────────────────────────────────────────

type Variable = { name: string; description?: string };

/**
 * A form-based variables editor. Each declared variable gets a labeled input
 * row synced with the sample_data JSON state. Editing an input immediately
 * updates the sample data via onChange (debounced externally if needed — the
 * parent controls the debounce on preview refresh, not on state update).
 */
function VariablesForm({
  variables,
  sampleData,
  onSampleDataChange,
}: {
  variables: Variable[];
  sampleData: Record<string, unknown>;
  onSampleDataChange: (next: Record<string, unknown>) => void;
}) {
  if (variables.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {variables.map((v) => (
        <div key={v.name} className="flex flex-col gap-0.5">
          <Label size="xsmall" className="font-mono text-ui-fg-base">
            {v.name}
          </Label>
          {v.description && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {v.description}
            </Text>
          )}
          <Input
            value={String(sampleData[v.name] ?? '')}
            onChange={(e) =>
              onSampleDataChange({ ...sampleData, [v.name]: e.target.value })
            }
            placeholder={`{{${v.name}}}`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Audience tab strip ───────────────────────────────────────────────────────

/**
 * Shows a Tabs strip when the current template belongs to a dual-audience
 * event. Navigates to the sibling row id when a tab is clicked; disabled tab
 * with tooltip when the sibling row doesn't exist yet.
 */
function AudienceTabStrip({
  templateKey,
  currentId,
  siblingRowIds,
}: {
  templateKey: string;
  currentId: string;
  siblingRowIds: Record<string, string>;
}) {
  const navigate = useNavigate();
  const siblings = getEventTemplatesForKey(templateKey);
  if (siblings.length <= 1) return null;

  return (
    <Tabs
      value={currentId}
      onValueChange={(id) => {
        if (id !== currentId) navigate(`/email-templates/${id}`);
      }}
    >
      <Tabs.List className="flex items-center gap-x-1 border-b border-ui-border-base bg-ui-bg-base px-6 py-2.5">
        {siblings.map((s) => {
          const rowId = s.key === templateKey ? currentId : siblingRowIds[s.key];
          const exists = !!rowId;
          return (
            <Tabs.Trigger
              key={s.key}
              value={rowId ?? `__missing__${s.key}`}
              disabled={!exists}
              title={
                !exists
                  ? 'Esta plantilla no existe todavía. Creala desde el listado.'
                  : undefined
              }
            >
              {s.audienceLabel}
              {!exists && (
                <span className="ml-1 text-ui-fg-muted text-xs">(no creada)</span>
              )}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
    </Tabs>
  );
}

// ─── Main editor ─────────────────────────────────────────────────────────────

const EmailTemplateEditor = ({ id }: { id: string }) => {
  const { t, i18n } = useTranslation('emailTemplates');
  registerEmailTemplatesTranslations(i18n);
  const navigate = useNavigate();

  const { data: template, isLoading } = useEmailTemplate(id);
  const updateMut = useUpdateEmailTemplate(id);
  const publishMut = usePublishEmailTemplate();
  const unpublishMut = useUnpublishEmailTemplate();
  const previewMut = usePreviewEmailTemplate(id);

  const [subject, setSubject] = useState<string | null>(null);
  const [sampleDataObj, setSampleDataObj] = useState<Record<string, unknown>>({});
  const [sampleDataText, setSampleDataText] = useState<string | null>(null);
  const [design, setDesign] = useState<Data | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [sendsOpen, setSendsOpen] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string }>({
    subject: '',
    html: '',
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Initialise sample data object from template.
  useEffect(() => {
    if (!template) return;
    const stored = template.sample_data ?? {};
    setSampleDataObj(stored as Record<string, unknown>);
    setSampleDataText(null); // reset advanced textarea to sync with stored
  }, [template]);

  const subjectValue = subject ?? template?.subject ?? '';
  const sampleDataValue =
    sampleDataText ?? JSON.stringify(sampleDataObj, null, 2);

  // The "live" parsed sample data — driven by whichever editor was last touched.
  const parsedSampleData = useMemo(() => {
    try {
      return {
        ok: true as const,
        data: JSON.parse(sampleDataValue || '{}') as Record<string, unknown>,
      };
    } catch {
      return { ok: false as const, data: {} as Record<string, unknown> };
    }
  }, [sampleDataValue]);

  // Keep sampleDataObj in sync when the advanced textarea is edited.
  useEffect(() => {
    if (sampleDataText === null) return; // driven by form, not textarea
    if (parsedSampleData.ok) setSampleDataObj(parsedSampleData.data);
  }, [sampleDataText, parsedSampleData]);

  const handleFormChange = useCallback((next: Record<string, unknown>) => {
    setSampleDataObj(next);
    setSampleDataText(JSON.stringify(next, null, 2));
  }, []);

  const initialDesign = useMemo<Data>(() => {
    if (!template) return EMPTY_DESIGN;
    if (template.design && Object.keys(template.design).length > 0) {
      return template.design as unknown as Data;
    }
    return htmlFallbackDesign(template.html ?? '');
  }, [template]);

  const currentDesign = design ?? initialDesign;

  // ─── Dual-audience siblings ─────────────────────────────────────────────────

  const eventId = template ? eventIdForKey(template.key) : null;
  const catalogSiblings = template ? getEventTemplatesForKey(template.key) : [];
  const dual = template ? isDualAudience(template.key) : false;

  // Fetch all templates for this event to resolve sibling row ids.
  const { data: allData } = useEmailTemplates({ limit: 100, offset: 0 });
  const allTemplates = allData?.email_templates ?? [];

  // Map catalog key → db row id for siblings.
  const siblingRowIds = useMemo<Record<string, string>>(() => {
    if (!eventId) return {};
    const result: Record<string, string> = {};
    for (const row of allTemplates) {
      const rowEvent = (row.metadata?.event as string | undefined) ?? eventIdForKey(row.key);
      if (rowEvent === eventId && row.id !== id) {
        result[row.key] = row.id;
      }
    }
    return result;
  }, [allTemplates, eventId, id]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSave = async (data: Data) => {
    if (!parsedSampleData.ok) {
      toast.error(t('VALIDATION_SAMPLE_DATA_JSON'));
      return;
    }
    try {
      await updateMut.mutateAsync({
        subject: subjectValue,
        design: data as unknown as Record<string, unknown>,
        sample_data: parsedSampleData.data,
      });
      setDesign(data);
      toast.success(t('UPDATE_SUCCESS'));
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  const refreshPreview = async () => {
    if (!parsedSampleData.ok) {
      toast.error(t('VALIDATION_SAMPLE_DATA_JSON'));
      return;
    }
    try {
      const rendered = await previewMut.mutateAsync({
        subject: subjectValue,
        design: currentDesign as unknown as Record<string, unknown>,
        data: parsedSampleData.data,
      });
      setPreview(rendered);
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  const openPreview = () => {
    setPreviewOpen(true);
    void refreshPreview();
  };

  const copyVariable = async (name: string) => {
    const token = `{{${name}}}`;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(
        t('EDITOR_VARIABLE_COPIED', { token, defaultValue: `Copiado: ${token}` }),
      );
    } catch {
      toast.error(t('ACTION_ERROR', { msg: token }));
    }
  };

  const handleTogglePublish = async () => {
    if (!template) return;
    try {
      if (template.status === 'published') {
        await unpublishMut.mutateAsync(template.id);
        toast.success(t('UNPUBLISH_SUCCESS'));
      } else {
        await publishMut.mutateAsync(template.id);
        toast.success(t('PUBLISH_SUCCESS'));
      }
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center p-12">
        <Text className="text-ui-fg-subtle">…</Text>
      </div>
    );
  }

  /**
   * Las variables de la FILA, y si no declara ninguna, las del catálogo del
   * código para esa `key`.
   *
   * El fallback no es cosmético: `VariablesForm` devuelve `null` con la lista
   * vacía y el bloque de "Datos de prueba" se reemplaza por un texto de vacío,
   * así que una fila con `variables` en `null` —lo que le pasa a TODA plantilla
   * creada fuera del seed o migrada desde el editor— esconde el único lugar
   * donde se ven y se tocan los valores del mail. La pantalla se ve igual que si
   * la plantilla no tuviera variables, cuando en realidad tiene siete.
   *
   * Gana la fila cuando declara algo: una plantilla puede haber sumado una
   * variable propia en su HTML y el catálogo del código no la conoce.
   */
  const declared = (template.variables ?? []) as Variable[];
  const variables = declared.length > 0 ? declared : (variablesForKey(template.key) as Variable[]);

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-ui-border-base border-b bg-ui-bg-base px-4 py-2">
        <div className="flex items-center gap-x-3">
          <Button
            variant="transparent"
            size="small"
            onClick={() => navigate('/email-templates')}
          >
            <ArrowLeft /> {t('EDITOR_BACK')}
          </Button>
          <div className="flex items-center gap-x-2">
            <Heading level="h2" className="text-base">
              {template.name}
            </Heading>
            <StatusBadge
              color={template.status === 'published' ? 'green' : 'orange'}
            >
              {t(`STATUS_${template.status.toUpperCase()}`)}
            </StatusBadge>
            <Text size="xsmall" className="text-ui-fg-subtle font-mono">
              {template.key}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-x-2">
          <Button
            variant="secondary"
            size="small"
            onClick={openPreview}
            isLoading={previewMut.isPending}
          >
            {t('EDITOR_PREVIEW')}
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setTestSendOpen(true)}
          >
            {t('EDITOR_TEST_SEND')}
          </Button>
          {/*
            Botón propio, al lado de "Vista previa" y no adentro. Los dos bloques de
            variables —los de demo y los reales— tienen que ser alcanzables por
            caminos distintos: meter los reales adentro de la vista previa haría que
            el único lugar donde se ven los valores de verdad esté detrás del botón
            que abre los de mentira, que es la confusión que esto vino a arreglar.
          */}
          <Button
            variant="secondary"
            size="small"
            onClick={() => setSendsOpen(true)}
          >
            {t('SENDS_BUTTON')}
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={handleTogglePublish}
            isLoading={publishMut.isPending || unpublishMut.isPending}
          >
            {template.status === 'published' ? t('UNPUBLISH') : t('PUBLISH')}
          </Button>
          <Button
            size="small"
            onClick={() => handleSave(currentDesign)}
            isLoading={updateMut.isPending}
          >
            {t('SAVE')}
          </Button>
        </div>
      </div>

      {/* ── Subject ── */}
      <div className="flex items-center gap-x-2 border-ui-border-base border-b bg-ui-bg-base px-4 py-2">
        <Label size="xsmall" className="shrink-0">
          {t('FIELD_SUBJECT')}
        </Label>
        <Input
          value={subjectValue}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('FIELD_SUBJECT_PLACEHOLDER')}
          className="max-w-xl"
        />
      </div>

      {/* ── Audience tabs (dual-audience only) ── */}
      {dual && (
        <AudienceTabStrip
          templateKey={template.key}
          currentId={id}
          siblingRowIds={siblingRowIds}
        />
      )}

      {/* Hide Puck's viewport/zoom canvas controls */}
      <style>{`[class*="_ViewportControls"] { display: none !important; }`}</style>

      {/* ── Block editor ── */}
      <div className="min-h-0 flex-1">
        <Puck
          config={emailPuckConfig}
          data={initialDesign}
          onChange={setDesign}
          onPublish={handleSave}
          headerTitle={template.name}
          headerPath={template.key}
          overrides={{ headerActions: () => null }}
        />
      </div>

      {/* ── Preview + variables + sample data (drawer) ── */}
      <Drawer open={previewOpen} onOpenChange={setPreviewOpen}>
        <Drawer.Content className="!max-w-[1100px] !w-[92vw]">
          <Drawer.Header>
            <Drawer.Title>{t('EDITOR_PREVIEW')}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex min-h-0 flex-1 gap-0 overflow-hidden p-0">
            {/* ── Izquierda: información / datos de prueba ── */}
            <div className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-ui-border-base p-4">
              {/* Datos de prueba (formulario) */}
              {variables.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Text size="small" weight="plus">
                    {t('EDITOR_VARIABLES_FORM', {
                      defaultValue: 'Datos de prueba',
                    })}
                  </Text>
                  {/*
                    El aviso va ACÁ, pegado al editor de demo, porque es acá donde el
                    operador cree que está viendo los valores reales. Decirlo sólo en
                    la sección de envíos no sirve: quien se confunde nunca llega a
                    esa sección. Misma clave que allá, para que las dos puntas del
                    contraste digan literalmente lo mismo.
                  */}
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('SENDS_VS_SAMPLE')}
                  </Text>
                  <VariablesForm
                    variables={variables}
                    sampleData={parsedSampleData.ok ? parsedSampleData.data : sampleDataObj}
                    onSampleDataChange={handleFormChange}
                  />
                </div>
              ) : (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('EDITOR_VARIABLES_EMPTY')}
                </Text>
              )}

              {/* Avanzado (colapsable): variables disponibles + JSON crudo */}
              <div className="flex flex-col gap-2 border-t border-ui-border-base pt-4">
                <button
                  type="button"
                  className="flex items-center gap-1 text-left"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {/*
                    `EDITOR_SAMPLE_DATA_ADVANCED`, la clave que existe. `EDITOR_ADVANCED`
                    no está definida en ningún namespace: no pintaba el nombre crudo
                    porque traía `defaultValue`, pero ese default estaba en español y
                    clavado, así que en inglés la pantalla mostraba "Avanzado" en medio
                    de todo lo demás traducido. Un fallback que tapa el síntoma es peor
                    que la clave faltante, porque no falla nunca.
                  */}
                  <Text size="small" weight="plus">
                    {t('EDITOR_SAMPLE_DATA_ADVANCED')}
                  </Text>
                  {advancedOpen ? (
                    <ChevronUpMini className="text-ui-fg-muted" />
                  ) : (
                    <ChevronDown className="text-ui-fg-muted" />
                  )}
                </button>
                {advancedOpen && (
                  <>
                    {/* Variables disponibles (click para copiar el token) */}
                    {variables.length > 0 && (
                      <div className="flex flex-col gap-1 rounded-lg bg-ui-bg-subtle p-3">
                        <Text size="xsmall" className="text-ui-fg-muted">
                          {t('EDITOR_VARIABLES_COPY_HINT', {
                            defaultValue: 'Hacé click para copiar el token.',
                          })}
                        </Text>
                        <div className="flex flex-wrap gap-1">
                          {variables.map((v) => (
                            <button
                              key={v.name}
                              type="button"
                              onClick={() => copyVariable(v.name)}
                              title={v.description || `{{${v.name}}}`}
                            >
                              <Badge
                                size="2xsmall"
                                className="cursor-pointer font-mono hover:opacity-80"
                              >
                                {`{{${v.name}}}`}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* JSON crudo de los datos de prueba */}
                    <Textarea
                      value={sampleDataValue}
                      onChange={(e) => setSampleDataText(e.target.value)}
                      rows={6}
                      className="font-mono text-xs"
                      spellCheck={false}
                    />
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t('EDITOR_SAMPLE_DATA_HELP')}
                    </Text>
                    {!parsedSampleData.ok && (
                      <Text size="xsmall" className="text-ui-fg-error">
                        {t('VALIDATION_SAMPLE_DATA_JSON')}
                      </Text>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Derecha: preview ── */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
              <div className="flex items-center justify-between">
                <Text size="small" weight="plus">
                  {t('EDITOR_PREVIEW_SUBJECT')}: {preview.subject}
                </Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={refreshPreview}
                  isLoading={previewMut.isPending}
                >
                  {t('EDITOR_PREVIEW_REFRESH')}
                </Button>
              </div>
              <iframe
                title="email-preview"
                srcDoc={preview.html}
                className="min-h-[480px] w-full flex-1 rounded-md border border-ui-border-base bg-white"
                sandbox=""
              />
            </div>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

      {/* ── Envíos reales (valores con los que el mail salió de verdad) ── */}
      <Drawer open={sendsOpen} onOpenChange={setSendsOpen}>
        <Drawer.Content className="!max-w-[720px] !w-[92vw]">
          <Drawer.Header>
            <Drawer.Title>{t('SENDS_TITLE')}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="min-h-0 flex-1 overflow-y-auto">
            {/*
              Montado sólo con el drawer abierto: si no, cada visita a la pantalla de
              una plantilla pegaría contra la ruta de envíos —que lee `notification`
              y arma el análisis— para nada. Y de paso, abrirlo siempre trae datos
              frescos sin depender del `staleTime` del hook.
            */}
            {sendsOpen && <RealSendsPanel templateId={id} />}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

      {/* ── Test-send modal ── */}
      <TestSendModal
        open={testSendOpen}
        onOpenChange={setTestSendOpen}
        template={template}
        siblingRowIds={siblingRowIds}
        sampleData={parsedSampleData.ok ? parsedSampleData.data : {}}
      />

      <Toaster />
    </div>
  );
};

/**
 * Envoltorio de ruta. LO IMPORTANTE ES EL `key={id}`.
 *
 * Las solapas Usuario/Admin navegan entre dos filas de la MISMA ruta
 * (`/email-templates/:id`), así que React Router reconcilia el mismo elemento en
 * vez de desmontarlo: el componente sobrevive al cambio de plantilla y se queda
 * con el estado de la anterior. Y `<Puck data={...}>` es NO CONTROLADO —toma
 * `data` como documento inicial y después ignora la prop—, de modo que el lienzo
 * seguía mostrando el diseño de la plantilla de la que venías. Ése era el
 * "quedo trabado en un template" que se reportaba.
 *
 * No era sólo visual: el lienzo mostraba A, la URL era B, y Guardar escribía el
 * diseño de A sobre B sin un solo aviso.
 *
 * El `key` remonta el editor entero cuando cambia el id. Se eligió eso y no
 * resetear los `useState` uno por uno a propósito: `subject`, `design`,
 * `sampleDataObj`, `sampleDataText`, los drawers abiertos y el estado interno de
 * Puck son seis cosas que hay que acordarse de limpiar, y la séptima que alguien
 * agregue en seis meses va a reintroducir exactamente este bug. El remontaje no
 * se puede olvidar.
 */
const EmailTemplateEditorRoute = () => {
  const { id = '' } = useParams();
  return <EmailTemplateEditor key={id} id={id} />;
};

export default EmailTemplateEditorRoute;
