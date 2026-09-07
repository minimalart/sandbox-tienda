import { Button, Drawer, Input, Label, Select, Text } from '@medusajs/ui';
import { useEffect } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { SynonymFormData } from '../../hooks/useSynonyms';

export interface SynonymFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SynonymFormData) => void;
  editingData?: {
    id: string;
    root?: string;
    synonyms: string[];
    locale?: string;
  } | null;
  loading?: boolean;
  title: string;
  subtitle?: string;
  submitText: string;
}

const SynonymFormDrawer = ({
  isOpen,
  onOpenChange,
  onSubmit,
  editingData,
  loading = false,
  title,
  submitText,
}: SynonymFormModalProps) => {
  const { t } = useTranslation('typesense');
  const form = useForm<SynonymFormData>({
    defaultValues: {
      id: editingData?.id ?? '',
      root: editingData?.root ?? '',
      synonyms: editingData?.synonyms?.join(', ') ?? '',
      locale: editingData?.locale && editingData.locale !== '' ? editingData.locale : 'global',
    },
  });

  const handleFormSubmit = form.handleSubmit((data) => {
    onSubmit(data);
  });

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  useEffect(() => {
    if (editingData) {
      form.reset({
        id: editingData.id ?? '',
        root: editingData.root ?? '',
        synonyms: editingData.synonyms?.join(', ') ?? '',
        locale: editingData.locale && editingData.locale !== '' ? editingData.locale : 'global',
      });
    }
  }, [editingData, form]);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <FormProvider {...form}>
          <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col overflow-hidden">
            <Drawer.Header>
              <Drawer.Title>{title}</Drawer.Title>
            </Drawer.Header>

            <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-8 overflow-y-auto">
              <Controller
                control={form.control}
                name="id"
                render={({ field }) => (
                  <div className="flex flex-col space-y-2">
                    <Label size="small" weight="plus">
                      {t('SYNONYM_ID_LABEL')}
                    </Label>
                    <Input
                      {...field}
                      placeholder={t('SYNONYM_ID_PLACEHOLDER')}
                      disabled={Boolean(editingData) || loading}
                    />
                    <Text className="text-xs text-ui-fg-subtle">
                      {editingData
                        ? t('SYNONYM_ID_HELP_TEXT_EDIT')
                        : t('SYNONYM_ID_HELP_TEXT_AUTO')}
                    </Text>
                  </div>
                )}
              />

              <Controller
                control={form.control}
                name="root"
                render={({ field }) => (
                  <div className="flex flex-col space-y-2">
                    <Label size="small" weight="plus">
                      {t('ROOT_TERM_LABEL')}
                    </Label>
                    <Input {...field} placeholder={t('ROOT_TERM_PLACEHOLDER')} disabled={loading} />
                    {/*
                      `ROOT_TERM_HELP_TEXT`, no `ROOT_TERM_HELP_TEXT_DETAILED`: esa
                      clave no existe en ningún namespace, así que i18next hacía
                      fallback al nombre de la clave y el usuario leía literalmente
                      "ROOT_TERM_HELP_TEXT_DETAILED" debajo del campo. Con el `.split('\n')`
                      que había acá tampoco fallaba: partía un string de una sola línea
                      y lo renderizaba igual. Una ayuda rota que no rompe nada.
                    */}
                    <Text className="text-xs text-ui-fg-subtle">
                      {t('ROOT_TERM_HELP_TEXT')}
                    </Text>
                  </div>
                )}
              />

              <Controller
                control={form.control}
                name="synonyms"
                rules={{ required: true }}
                render={({ field }) => (
                  <div className="flex flex-col space-y-2">
                    <Label size="small" weight="plus">
                      {t('SYNONYMS_FIELD_LABEL_COMMA')}
                    </Label>
                    {/* `SYNONYMS_FIELD_PLACEHOLDER`, sin el `_ALT`: esa variante no
                        existe y el placeholder mostraba el nombre de la clave. Es el
                        mismo rename a medias que dejó huérfana a `ROOT_TERM_HELP_TEXT`
                        en este archivo. */}
                    <Input
                      {...field}
                      placeholder={t('SYNONYMS_FIELD_PLACEHOLDER')}
                      disabled={loading}
                    />
                  </div>
                )}
              />

              <Controller
                control={form.control}
                name="locale"
                render={({ field }) => (
                  <div className="flex flex-col space-y-2">
                    <Label size="small" weight="plus">
                      {t('SYNONYMS_LOCALE_LABEL')}
                    </Label>
                    <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                      <Select.Trigger>
                        <Select.Value placeholder={t('SYNONYMS_LOCALE_PLACEHOLDER')} />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="global">{t('LANGUAGE_GLOBAL')}</Select.Item>
                        <Select.Item value="es">{t('LANGUAGE_SPANISH')}</Select.Item>
                        <Select.Item value="en">{t('LANGUAGE_ENGLISH')}</Select.Item>
                        <Select.Item value="fr">{t('LANGUAGE_FRENCH')}</Select.Item>
                        <Select.Item value="de">{t('LANGUAGE_GERMAN')}</Select.Item>
                        <Select.Item value="it">{t('LANGUAGE_ITALIAN')}</Select.Item>
                        <Select.Item value="pt">{t('LANGUAGE_PORTUGUESE')}</Select.Item>
                      </Select.Content>
                    </Select>
                    <Text className="text-xs text-ui-fg-subtle">
                      {t('SYNONYMS_LOCALE_HELP_TEXT')}
                    </Text>
                  </div>
                )}
              />
            </Drawer.Body>

            <Drawer.Footer>
              <div className="flex items-center justify-end gap-x-2">
                <Drawer.Close asChild>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    {t('CANCEL_BUTTON')}
                  </Button>
                </Drawer.Close>
                <Button size="small" type="submit" disabled={loading}>
                  {loading ? t('SAVING_TEXT') : submitText}
                </Button>
              </div>
            </Drawer.Footer>
          </form>
        </FormProvider>
      </Drawer.Content>
    </Drawer>
  );
};

export default SynonymFormDrawer;
