import { CheckCircleSolid, InformationCircle } from '@medusajs/icons';
import {
  Badge,
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  ProgressTabs,
  Select,
  Switch,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreateKapsoTemplate,
  KapsoTemplate,
  useCreateKapsoTemplate,
  useDeleteKapsoBinding,
  useKapsoBindings,
  useKapsoTemplates,
  useSaveKapsoBinding,
  useUpdateKapsoTemplate,
} from '../../../hooks/api/kapso';
import {
  WHATSAPP_EVENTS,
  WHATSAPP_EVENT_BY_KEY,
} from '../../../lib/whatsapp-events-catalog';
import { kapsoErrorKey } from '../../../lib/kapso-error';
import {
  SuggestedTemplate,
  WHATSAPP_SUGGESTED_TEMPLATES,
} from '../../../lib/whatsapp-suggested-templates';
import { registerWhatsappTranslations } from '../../../translations/whatsapp';
import { WhatsAppBodyEditor } from './whatsapp-body-editor';
import { WhatsAppTemplatePreview } from './whatsapp-template-preview';

type Category = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

/** Estados de Meta en los que se puede editar el contenido/categoría. */
const EDITABLE_STATUSES = ['APPROVED', 'REJECTED', 'PAUSED'];

/** Valores iniciales para pre-cargar el modal (ej. desde una plantilla sugerida). */
export type TemplateInitial = Partial<{
  name: string;
  language: string;
  category: Category;
  body: string;
  examples: string[];
  eventKey: string;
}>;

const CATEGORY_INFO_KEY: Record<Category, string> = {
  UTILITY: 'CATEGORY_UTILITY_INFO',
  MARKETING: 'CATEGORY_MARKETING_INFO',
  AUTHENTICATION: 'CATEGORY_AUTHENTICATION_INFO',
};

const EMPTY = {
  name: '',
  language: 'es',
  category: 'UTILITY' as Category,
  body: '',
  examples: [] as string[],
  eventKey: '',
  params: [] as string[],
  publishBinding: false,
};

type FormState = typeof EMPTY;

const TABS = ['basics', 'content', 'assign'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL_KEY: Record<Tab, string> = {
  basics: 'TAB_BASICS',
  content: 'TAB_CONTENT',
  assign: 'TAB_ASSIGN',
};

function normalizeCategory(raw?: string): Category {
  const upper = (raw ?? '').toUpperCase();
  return upper === 'MARKETING' || upper === 'AUTHENTICATION'
    ? (upper as Category)
    : 'UTILITY';
}

/** Componente BODY del template (para leer texto y ejemplos al editar). */
function bodyComponentOf(components?: Array<Record<string, unknown>>) {
  return components?.find(
    (c) => String((c as { type?: string }).type ?? '').toUpperCase() === 'BODY',
  );
}

function bodyTextOf(components?: Array<Record<string, unknown>>): string {
  return (bodyComponentOf(components)?.text as string) ?? '';
}

function bodyExamplesOf(components?: Array<Record<string, unknown>>): string[] {
  const example = bodyComponentOf(components)?.example as
    | { body_text?: string[][] }
    | undefined;
  return example?.body_text?.[0] ?? [];
}

/**
 * Modal de creación/edición de plantillas de WhatsApp.
 *
 * - Sin `template`: crear. Chooser inicial (desde cero / sugeridas) + wizard de 3
 *   pasos (Datos, Contenido, Asignación) con vista previa. En el submit se crea la
 *   plantilla en Meta y, opcionalmente, se guarda la asignación a un evento.
 * - Con `template`: editar. Se precargan datos + asignación existente. El nombre y
 *   el idioma quedan bloqueados (Meta no permite cambiarlos). El contenido y la
 *   categoría solo se pueden editar si el estado de Meta lo permite (APPROVED,
 *   REJECTED o PAUSED); editar contenido reenvía la plantilla a revisión. La
 *   asignación a evento (interna) se puede editar siempre.
 */
export const TemplateCreateModal = ({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente → modo edición sobre esta plantilla. */
  template?: KapsoTemplate;
}) => {
  const { t, i18n } = useTranslation('whatsapp');
  registerWhatsappTranslations(i18n);

  const isEdit = !!template;
  const contentEditable =
    !isEdit || EDITABLE_STATUSES.includes((template?.status ?? '').toUpperCase());

  const [mode, setMode] = useState<'chooser' | 'form'>('chooser');
  const [activeTab, setActiveTab] = useState<Tab>('basics');
  const [form, setForm] = useState<FormState>(EMPTY);
  // Guard anti-doble-create: si el create sale OK pero el binding falla, en el
  // reintento salteamos el create (la plantilla ya existe como PENDING).
  const createdNameRef = useRef<string | null>(null);
  const [isCreated, setIsCreated] = useState(false);
  // En edición: evento al que apuntaba la plantilla al abrir (para des-asignar si
  // cambia) y guard para hidratar la asignación una sola vez.
  const originalEventKeyRef = useRef<string>('');
  const hydratedBindingRef = useRef(false);

  const { mutateAsync: createTemplate, isPending: creating } = useCreateKapsoTemplate();
  const { mutateAsync: updateTemplate, isPending: updating } = useUpdateKapsoTemplate();
  const { mutateAsync: saveBinding, isPending: saving } = useSaveKapsoBinding();
  const { mutateAsync: deleteBinding } = useDeleteKapsoBinding();
  const { data: templatesData, isError: listErrored } = useKapsoTemplates({ retry: false });
  const { data: bindingsData } = useKapsoBindings({ retry: false, enabled: open && isEdit });

  const existingNames = useMemo(
    () => new Set((templatesData?.templates ?? []).map((tpl) => tpl.name)),
    [templatesData],
  );

  // Al abrir: en creación reseteamos al chooser; en edición precargamos la
  // plantilla y saltamos directo al formulario.
  useEffect(() => {
    if (!open) return;
    createdNameRef.current = null;
    setIsCreated(false);
    hydratedBindingRef.current = false;
    originalEventKeyRef.current = '';
    setActiveTab('basics');
    if (isEdit && template) {
      setMode('form');
      setForm({
        ...EMPTY,
        name: template.name,
        language: template.language,
        category: normalizeCategory(template.category),
        body: bodyTextOf(template.components),
        examples: bodyExamplesOf(template.components),
      });
    } else {
      setMode('chooser');
      setForm(EMPTY);
    }
  }, [open, isEdit, template?.name]);

  // Al editar: hidratar la asignación existente cuando lleguen los bindings (una
  // sola vez, sin pisar ediciones del cuerpo).
  useEffect(() => {
    if (!open || !isEdit || !template || hydratedBindingRef.current) return;
    const bindings = bindingsData?.bindings;
    if (!bindings) return;
    hydratedBindingRef.current = true;
    const entry = Object.entries(bindings).find(
      ([, b]) => b.template_name === template.name,
    );
    if (entry) {
      const [key, b] = entry;
      originalEventKeyRef.current = key;
      setForm((prev) => ({
        ...prev,
        eventKey: key,
        params: b.params ?? [],
        publishBinding: b.status === 'published',
      }));
    }
  }, [open, isEdit, template?.name, bindingsData]);

  const placeholderCount = useMemo(
    () =>
      (form.body.match(/\{\{\s*\d+\s*\}\}/g) ?? [])
        .map((m) => m.replace(/\D/g, ''))
        .filter((v, i, a) => a.indexOf(v) === i).length,
    [form.body],
  );

  const event = form.eventKey ? WHATSAPP_EVENT_BY_KEY[form.eventKey] : undefined;
  const eventLabel = event ? t(event.labelKey) : form.eventKey;

  // Bloqueos de campos: nombre/idioma siempre fijos al editar; contenido/categoría
  // solo si el estado de Meta lo permite (o, al crear, tras un create OK).
  const identityDisabled = isEdit || isCreated;
  const contentDisabled = isEdit ? !contentEditable : isCreated;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setParam = (index: number, value: string) =>
    setForm((prev) => {
      const params = [...prev.params];
      params.length = placeholderCount;
      params[index] = value;
      return { ...prev, params };
    });

  const setExample = (index: number, value: string) =>
    setForm((prev) => {
      const examples = [...prev.examples];
      examples.length = placeholderCount;
      examples[index] = value;
      return { ...prev, examples };
    });

  const close = () => onOpenChange(false);

  const startFromScratch = () => {
    setForm(EMPTY);
    setMode('form');
    setActiveTab('basics');
  };

  const startFromPreset = (preset: SuggestedTemplate) => {
    setForm({
      ...EMPTY,
      name: preset.name,
      language: preset.language,
      category: preset.category,
      body: preset.body,
      examples: [...preset.example],
      eventKey: preset.eventKey,
    });
    setMode('form');
    setActiveTab('basics');
  };

  const activeIndex = TABS.indexOf(activeTab);
  const isLastTab = activeIndex === TABS.length - 1;

  const goNext = () => {
    if (activeTab === 'basics') {
      if (!form.name.trim()) {
        toast.error(t('ERROR_NAME_BODY_REQUIRED'));
        return;
      }
      setActiveTab('content');
      return;
    }
    if (activeTab === 'content') {
      if (!form.body.trim()) {
        toast.error(t('ERROR_NAME_BODY_REQUIRED'));
        return;
      }
      setActiveTab('assign');
    }
  };

  const goBack = () => {
    if (activeTab === 'content') setActiveTab('basics');
    else if (activeTab === 'assign') setActiveTab('content');
    else if (!isEdit) setMode('chooser');
  };

  /** Construye los `components` a editar preservando HEADER/FOOTER/BUTTONS. */
  function buildComponents(body: string, exampleValues: string[]) {
    const bodyComp: Record<string, unknown> = { type: 'BODY', text: body };
    if (placeholderCount > 0) bodyComp.example = { body_text: [exampleValues] };
    const originals = template?.components ?? [];
    let replaced = false;
    const next = originals.map((c) => {
      if (String((c as { type?: string }).type ?? '').toUpperCase() === 'BODY') {
        replaced = true;
        return bodyComp;
      }
      return c;
    });
    if (!replaced) next.push(bodyComp);
    return next;
  }

  /** Sincroniza la asignación a evento en el submit (save + des-asignar previo). */
  async function syncBinding(name: string, language: string) {
    const original = originalEventKeyRef.current;
    // Guardar la asignación actual (si hay evento elegido).
    if (form.eventKey) {
      await saveBinding({
        key: form.eventKey,
        template_name: name,
        language,
        params: form.params.slice(0, placeholderCount),
        status: form.publishBinding ? 'published' : 'draft',
      });
    }
    // Si apuntaba a otro evento y cambió (o se quitó), des-asignar el anterior.
    if (isEdit && original && original !== form.eventKey) {
      await deleteBinding(original);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const body = form.body.trim();
    const language = form.language.trim() || 'es';
    if (!name || !body) {
      toast.error(t('ERROR_NAME_BODY_REQUIRED'));
      setActiveTab(!name ? 'basics' : 'content');
      return;
    }

    const exampleValues = Array.from({ length: placeholderCount }, (_, i) =>
      (form.examples[i] ?? '').trim(),
    );
    // Los ejemplos solo se exigen si el contenido es editable (al crear siempre lo
    // es; al editar una plantilla bloqueada no tocamos el contenido).
    if (!contentDisabled && placeholderCount > 0 && exampleValues.some((v) => !v)) {
      toast.error(t('ERROR_EXAMPLE_REQUIRED', { range: `{{1}}…{{${placeholderCount}}}` }));
      setActiveTab('content');
      return;
    }

    if (form.eventKey && placeholderCount > 0) {
      const mapped = form.params.slice(0, placeholderCount);
      if (mapped.length !== placeholderCount || mapped.some((p) => !p)) {
        toast.error(t('ERROR_MAPPING_REQUIRED'));
        return;
      }
    }

    // ───────────────────────── Edición ─────────────────────────
    if (isEdit && template) {
      const originalBody = bodyTextOf(template.components);
      const originalExamples = bodyExamplesOf(template.components);
      const contentChanged =
        !contentDisabled &&
        (body !== originalBody.trim() ||
          form.category !== normalizeCategory(template.category) ||
          JSON.stringify(exampleValues) !== JSON.stringify(originalExamples));

      try {
        if (contentChanged) {
          if (!template.id) {
            toast.error(t('TOAST_UPDATE_FAILED'));
            return;
          }
          await updateTemplate({
            name,
            id: template.id,
            category: form.category,
            components: buildComponents(body, exampleValues),
          });
        }
        await syncBinding(name, language);
        toast.success(t('TOAST_UPDATED', { name }));
        close();
      } catch (err) {
        const raw = (err as Error)?.message;
        const known = kapsoErrorKey(raw);
        toast.error(t('TOAST_UPDATE_FAILED'), { description: known ? t(known) : raw });
      }
      return;
    }

    // ───────────────────────── Creación ─────────────────────────
    // Paso 1 (idempotente): crear el template en Meta, salvo que ya lo hayamos
    // creado en un intento previo (binding falló y estamos reintentando).
    const alreadyCreated = createdNameRef.current === name;
    if (!alreadyCreated) {
      const payload: CreateKapsoTemplate = {
        name,
        language,
        category: form.category,
        components: buildComponents(body, exampleValues),
      };
      try {
        await createTemplate(payload);
        createdNameRef.current = name;
        setIsCreated(true);
        toast.success(t('TOAST_CREATED', { name }));
      } catch (err) {
        const raw = (err as Error)?.message;
        const known = kapsoErrorKey(raw);
        toast.error(t('TOAST_CREATE_FAILED'), { description: known ? t(known) : raw });
        return;
      }
    }

    // Paso 2 (opcional): asignar a un evento.
    if (!form.eventKey) {
      close();
      return;
    }
    try {
      await syncBinding(name, language);
      toast.success(t('TOAST_ASSIGNED', { name, event: eventLabel }));
      close();
    } catch (err) {
      // El template ya se creó; nos quedamos en el paso de asignación para
      // reintentar solo el binding.
      const raw = (err as Error)?.message;
      const known = kapsoErrorKey(raw);
      toast.error(t('TOAST_CREATED_ASSIGN_FAILED', { name }), {
        description: known ? t(known) : raw,
      });
    }
  }

  const submitting = creating || updating || saving;
  const submitLabel = isEdit ? t('BTN_SAVE_CHANGES') : t('BTN_CREATE');
  const showBack = !(isEdit && activeTab === 'basics');

  return (
    <FocusModal open={open} onOpenChange={(v) => !v && close()}>
      <FocusModal.Content>
        {mode === 'chooser' ? (
          <div className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <FocusModal.Title asChild>
                <span className="sr-only">{t('FORM_CREATE_TITLE')}</span>
              </FocusModal.Title>
            </FocusModal.Header>

            <FocusModal.Body className="flex-1 overflow-y-auto px-8 py-10">
              <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
                <Heading>{t('CHOOSER_TITLE')}</Heading>

                <button
                  type="button"
                  onClick={startFromScratch}
                  className="flex flex-col gap-1 rounded-lg border border-ui-border-base p-4 text-left hover:bg-ui-bg-base-hover"
                >
                  <Text weight="plus">{t('CHOOSER_SCRATCH_TITLE')}</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('CHOOSER_SCRATCH_DESC')}
                  </Text>
                </button>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Text weight="plus">{t('CHOOSER_PRESETS_TITLE')}</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CHOOSER_PRESETS_DESC')}
                    </Text>
                  </div>

                  <div className="flex flex-col divide-y rounded-lg border border-ui-border-base">
                    {WHATSAPP_SUGGESTED_TEMPLATES.map((preset) => {
                      const exists = existingNames.has(preset.name);
                      return (
                        <div
                          key={preset.name}
                          className="flex items-start justify-between gap-4 px-4 py-3"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Text weight="plus">{preset.name}</Text>
                              <Badge size="2xsmall">{preset.category}</Badge>
                              <Badge size="2xsmall">{t(preset.eventLabelKey)}</Badge>
                              {exists && (
                                <Badge size="2xsmall" color="green">
                                  {t('CHOOSER_PRESET_EXISTS')}
                                </Badge>
                              )}
                            </div>
                            <Text size="small" className="text-ui-fg-subtle">
                              {preset.body}
                            </Text>
                          </div>
                          <div className="shrink-0">
                            <Button
                              size="small"
                              variant="secondary"
                              disabled={exists}
                              onClick={() => startFromPreset(preset)}
                            >
                              {t('CHOOSER_PRESET_USE')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {listErrored && (
                    <Text size="small" className="text-ui-fg-muted">
                      {t('CHOOSER_VERIFY_FAILED')}
                    </Text>
                  )}
                </div>
              </div>
            </FocusModal.Body>

            <FocusModal.Footer>
              <div className="flex items-center justify-end gap-x-2">
                <Button variant="secondary" size="small" onClick={close}>
                  {t('BTN_CANCEL')}
                </Button>
              </div>
            </FocusModal.Footer>
          </div>
        ) : (
          <ProgressTabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
            className="flex h-full flex-col overflow-hidden"
          >
            <FocusModal.Header className="flex items-center gap-4">
              <FocusModal.Title asChild>
                <span className="sr-only">
                  {isEdit ? t('FORM_EDIT_TITLE') : t('FORM_CREATE_TITLE')}
                </span>
              </FocusModal.Title>
              <div className="-my-2 w-full border-l">
                <ProgressTabs.List>
                  {TABS.map((tab, index) => (
                    <ProgressTabs.Trigger
                      key={tab}
                      value={tab}
                      status={
                        index < activeIndex
                          ? 'completed'
                          : index === activeIndex
                            ? 'in-progress'
                            : 'not-started'
                      }
                    >
                      {t(TAB_LABEL_KEY[tab])}
                    </ProgressTabs.Trigger>
                  ))}
                </ProgressTabs.List>
              </div>
            </FocusModal.Header>

            <FocusModal.Body className="flex flex-1 justify-center overflow-y-auto">
              <form
                id="whatsapp-template-form"
                onSubmit={handleSubmit}
                className="flex w-full max-w-[1040px] gap-10 px-8 py-12"
              >
                {/* Left: active tab fields */}
                <div className="min-w-0 flex-1">
                  <div className="flex w-full flex-col">
                    <ProgressTabs.Content value="basics" className="flex flex-col gap-8">
                      <Heading>{t('TAB_BASICS')}</Heading>
                      {isEdit && (
                        <div className="flex items-start gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                          <InformationCircle className="mt-0.5 shrink-0 text-ui-fg-muted" />
                          <Text size="small" className="text-ui-fg-subtle">
                            {t('EDIT_LOCKED_HINT')}
                          </Text>
                        </div>
                      )}
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <Label size="small">{t('FIELD_NAME')}</Label>
                          <Input
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder={t('PLACEHOLDER_NAME')}
                            disabled={identityDisabled}
                          />
                          <Text size="small" className="text-ui-fg-subtle">
                            {t('HELP_NAME')}
                          </Text>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label size="small">{t('FIELD_CATEGORY')}</Label>
                          <Select
                            value={form.category}
                            onValueChange={(v) => set('category', v as Category)}
                            disabled={contentDisabled}
                          >
                            <Select.Trigger>
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              <Select.Item value="UTILITY">UTILITY</Select.Item>
                              <Select.Item value="MARKETING">MARKETING</Select.Item>
                              <Select.Item value="AUTHENTICATION">AUTHENTICATION</Select.Item>
                            </Select.Content>
                          </Select>
                          <Text size="small" className="text-ui-fg-subtle">
                            {t(CATEGORY_INFO_KEY[form.category])}
                          </Text>
                          <Text size="small" className="text-ui-fg-muted">
                            {t('CATEGORY_RECATEGORIZE_NOTE')}
                          </Text>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label size="small">{t('FIELD_LANGUAGE')}</Label>
                          <Input
                            value={form.language}
                            onChange={(e) => set('language', e.target.value)}
                            placeholder={t('PLACEHOLDER_LANGUAGE')}
                            disabled={identityDisabled}
                          />
                        </div>
                      </div>
                    </ProgressTabs.Content>

                    <ProgressTabs.Content value="content" className="flex flex-col gap-8">
                      <Heading>{t('TAB_CONTENT')}</Heading>
                      {isEdit && (
                        <div className="flex items-start gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                          <InformationCircle className="mt-0.5 shrink-0 text-ui-fg-muted" />
                          <Text size="small" className="text-ui-fg-subtle">
                            {contentEditable
                              ? t('EDIT_APPROVED_WARNING')
                              : t('EDIT_STATUS_LOCKED')}
                          </Text>
                        </div>
                      )}
                      <div className="flex flex-col gap-4">
                        <WhatsAppBodyEditor
                          value={form.body}
                          onChange={(next) => set('body', next)}
                          disabled={contentDisabled}
                          placeholderCount={placeholderCount}
                        />

                        {placeholderCount > 0 && (
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                              <Label size="small">{t('FIELD_EXAMPLES')}</Label>
                              <Text size="small" className="text-ui-fg-subtle">
                                {t('EXAMPLES_HINT')}
                              </Text>
                            </div>
                            {Array.from({ length: placeholderCount }).map((_, i) => (
                              <div
                                key={i}
                                className="flex items-stretch overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-field transition-colors focus-within:border-ui-border-interactive"
                              >
                                <span className="flex shrink-0 items-center border-r border-ui-border-base bg-ui-bg-subtle px-2.5 font-mono text-xs text-ui-fg-subtle">
                                  {`{{${i + 1}}}`}
                                </span>
                                <input
                                  className="w-full min-w-0 bg-transparent px-3 py-1.5 text-sm text-ui-fg-base outline-none placeholder:text-ui-fg-muted disabled:cursor-not-allowed disabled:text-ui-fg-disabled"
                                  value={form.examples[i] ?? ''}
                                  onChange={(e) => setExample(i, e.target.value)}
                                  placeholder={t('EXAMPLE_PLACEHOLDER', {
                                    token: `{{${i + 1}}}`,
                                  })}
                                  disabled={contentDisabled}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </ProgressTabs.Content>

                    <ProgressTabs.Content value="assign" className="flex flex-col gap-8">
                      <Heading>{t('TAB_ASSIGN')}</Heading>
                      <div className="flex flex-col gap-3 rounded-md border border-ui-border-base p-3">
                        {!isEdit && (
                          <div className="flex items-start gap-2">
                            {isCreated ? (
                              <CheckCircleSolid className="mt-0.5 shrink-0 text-ui-fg-interactive" />
                            ) : (
                              <InformationCircle className="mt-0.5 shrink-0 text-ui-fg-muted" />
                            )}
                            <Text
                              size="small"
                              className={isCreated ? 'text-ui-fg-base' : 'text-ui-fg-subtle'}
                            >
                              {isCreated ? t('ASSIGN_INFO_READY') : t('ASSIGN_INFO_PENDING')}
                            </Text>
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <Label size="small">{t('FIELD_ASSIGN_EVENT')}</Label>
                          <Select
                            value={form.eventKey}
                            onValueChange={(v) => set('eventKey', v)}
                          >
                            <Select.Trigger>
                              <Select.Value placeholder={t('ASSIGN_EVENT_PLACEHOLDER')} />
                            </Select.Trigger>
                            <Select.Content>
                              {WHATSAPP_EVENTS.map((e) => (
                                <Select.Item key={e.key} value={e.key}>
                                  {t(e.labelKey)}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        </div>

                        {event && placeholderCount > 0 && (
                          <div className="flex flex-col gap-2">
                            <Label size="small">{t('FIELD_VAR_MAPPING')}</Label>
                            {Array.from({ length: placeholderCount }).map((_, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Badge size="small">{`{{${i + 1}}}`}</Badge>
                                <Select
                                  value={form.params[i] ?? ''}
                                  onValueChange={(v) => setParam(i, v)}
                                >
                                  <Select.Trigger>
                                    <Select.Value placeholder={t('VAR_MAPPING_PLACEHOLDER')} />
                                  </Select.Trigger>
                                  <Select.Content>
                                    {event.variables.map((v) => (
                                      <Select.Item key={v.name} value={v.name}>
                                        {t(v.labelKey)} ({v.name})
                                      </Select.Item>
                                    ))}
                                  </Select.Content>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}

                        {event && placeholderCount === 0 && (
                          <Text size="small" className="text-ui-fg-subtle">
                            {t('NO_VARS_HINT')}
                          </Text>
                        )}

                        {event && (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={form.publishBinding}
                              onCheckedChange={(v) => set('publishBinding', v)}
                              id="publish-binding"
                            />
                            <Label size="small" htmlFor="publish-binding">
                              {t('FIELD_PUBLISH')}
                            </Label>
                          </div>
                        )}
                      </div>
                    </ProgressTabs.Content>
                  </div>
                </div>

                {/* Right: live preview, persistent across tabs */}
                <aside className="hidden w-[360px] shrink-0 lg:block">
                  <div className="sticky top-0 rounded-xl border border-ui-border-base bg-ui-bg-subtle p-4">
                    <WhatsAppTemplatePreview value={form.body} examples={form.examples} />
                  </div>
                </aside>
              </form>
            </FocusModal.Body>

            <FocusModal.Footer>
              <div className="flex items-center justify-end gap-x-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={close}
                  disabled={submitting}
                >
                  {t('BTN_CANCEL')}
                </Button>
                {showBack && (
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    onClick={goBack}
                    disabled={submitting}
                  >
                    {t('BTN_BACK')}
                  </Button>
                )}
                {isLastTab ? (
                  <Button
                    type="submit"
                    size="small"
                    form="whatsapp-template-form"
                    isLoading={submitting}
                  >
                    {submitLabel}
                  </Button>
                ) : (
                  <Button type="button" size="small" onClick={goNext}>
                    {t('BTN_CONTINUE')}
                  </Button>
                )}
              </div>
            </FocusModal.Footer>
          </ProgressTabs>
        )}
      </FocusModal.Content>
    </FocusModal>
  );
};
