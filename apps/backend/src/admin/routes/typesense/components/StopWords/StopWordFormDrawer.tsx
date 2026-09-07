import { Button, Drawer, Input, Label, Select, Text, Textarea } from '@medusajs/ui';
import { useEffect } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type {
  StopWordFormData,
  StopWordFormModalProps,
} from '../../../../../modules/typesense/types';

const StopWordFormDrawer = ({
  isOpen,
  onOpenChange,
  onSubmit,
  editingData,
  loading = false,
  title,
  submitText,
}: StopWordFormModalProps) => {
  const { t } = useTranslation('typesense');
  const form = useForm<StopWordFormData>({
    defaultValues: {
      id: editingData?.id ?? '',
      stopwords: editingData?.stopwords?.join(', ') ?? '',
      locale: editingData?.locale ?? 'es',
    },
  });

  const {
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (editingData) {
      reset({
        id: editingData.id ?? '',
        stopwords: editingData.stopwords?.join(', ') ?? '',
        locale: editingData.locale ?? 'es',
      });
    }
  }, [editingData, reset]);

  const handleFormSubmit = (data: StopWordFormData) => {
    const idValue = data.id ?? '';
    const stopwordsValue = data.stopwords ?? '';
    const localeValue = data.locale ?? 'es';

    if (!idValue.trim() || !stopwordsValue.trim()) {
      return;
    }

    const idRegex = /^[a-zA-Z0-9_-]+$/;
    if (!idRegex.test(idValue)) {
      return;
    }

    onSubmit({ id: idValue, stopwords: stopwordsValue, locale: localeValue });
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  const watchedStopwords = watch('stopwords');
  const stopWordsPreview = watchedStopwords
    ? watchedStopwords
        .split(',')
        .map((word) => word.trim())
        .filter((word) => word.length > 0)
        .slice(0, 10)
    : [];
  const totalWords = watchedStopwords
    ? watchedStopwords
        .split(',')
        .map((word) => word.trim())
        .filter((word) => word.length > 0).length
    : 0;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <FormProvider {...form}>
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <Drawer.Header>
              <Drawer.Title>{title}</Drawer.Title>
            </Drawer.Header>

            <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-8 overflow-y-auto">
              <Controller
                control={control}
                name="id"
                rules={{
                  required: t('STOPWORDS_ID_REQUIRED'),
                  pattern: {
                    value: /^[a-zA-Z0-9_-]+$/,
                    message: t('STOPWORDS_ID_PATTERN_ERROR'),
                  },
                }}
                render={({ field }) => (
                  <div className="flex flex-col space-y-2">
                    <Label size="small" weight="plus">
                      {t('STOPWORDS_ID_LABEL')}
                    </Label>
                    <Input
                      {...field}
                      placeholder={t('STOPWORDS_ID_PLACEHOLDER')}
                      disabled={Boolean(editingData) || loading}
                    />
                    {errors.id ? (
                      <Text size="small" className="text-ui-fg-error">
                        {errors.id.message}
                      </Text>
                    ) : null}
                    <Text className="text-xs text-ui-fg-subtle">
                      {editingData
                        ? t('STOPWORDS_ID_HELP_TEXT_EDIT')
                        : t('STOPWORDS_ID_HELP_TEXT_AUTO')}
                    </Text>
                  </div>
                )}
              />

              <Controller
                control={control}
                name="locale"
                render={({ field }) => (
                  <div className="flex flex-col space-y-2">
                    <Label size="small" weight="plus">
                      {t('STOPWORDS_LOCALE_LABEL')}
                    </Label>
                    <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                      <Select.Trigger>
                        <Select.Value placeholder={t('STOPWORDS_LOCALE_PLACEHOLDER')} />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="es">{t('LANGUAGE_SPANISH')}</Select.Item>
                        <Select.Item value="en">{t('LANGUAGE_ENGLISH')}</Select.Item>
                        <Select.Item value="fr">{t('LANGUAGE_FRENCH')}</Select.Item>
                        <Select.Item value="de">{t('LANGUAGE_GERMAN')}</Select.Item>
                        <Select.Item value="it">{t('LANGUAGE_ITALIAN')}</Select.Item>
                        <Select.Item value="pt">{t('LANGUAGE_PORTUGUESE')}</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                )}
              />

              <Controller
                control={control}
                name="stopwords"
                rules={{ required: t('STOPWORDS_WORDS_REQUIRED') }}
                render={({ field }) => (
                  <div className="flex flex-col space-y-2">
                    <Label size="small" weight="plus">
                      {t('STOPWORDS_WORDS_LABEL')}
                    </Label>
                    <Textarea
                      {...field}
                      placeholder={t('STOPWORDS_WORDS_PLACEHOLDER')}
                      rows={4}
                      disabled={loading}
                    />
                    {errors.stopwords ? (
                      <Text size="small" className="text-ui-fg-error">
                        {errors.stopwords.message}
                      </Text>
                    ) : null}
                    <Text className="text-xs text-ui-fg-subtle">
                      {t('STOPWORDS_WORDS_HELP_TEXT')}
                    </Text>
                  </div>
                )}
              />

              {stopWordsPreview.length > 0 ? (
                <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle p-4">
                  <Text size="small" weight="plus" className="mb-3 text-ui-fg-base">
                    {t('STOPWORDS_PREVIEW_TITLE')
                      .replace('{{count}}', totalWords.toString())
                      .replace('{{plural}}', totalWords !== 1 ? 's' : '')}
                    :
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    {stopWordsPreview.map((word, index) => (
                      <span
                        key={`${word}-${index}`}
                        className="rounded-md bg-ui-tag-neutral-bg px-2 py-1 text-xs font-medium text-ui-tag-neutral-text"
                      >
                        {word}
                      </span>
                    ))}
                    {totalWords > 10 ? (
                      <span className="px-2 py-1 text-xs font-medium text-ui-fg-subtle">
                        {t('STOPWORDS_PREVIEW_MORE').replace(
                          '{{count}}',
                          (totalWords - 10).toString()
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
                <Button type="submit" size="small" disabled={loading}>
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

export default StopWordFormDrawer;
