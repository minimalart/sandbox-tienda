import { Button, Container, Heading, Input, Label, Text, Textarea, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useBundle,
  useDeleteBundle,
  usePublishBundle,
  useUpdateBundle,
} from '../../../hooks/api/bundles';
import { registerBundlesTranslations } from '../../../translations/bundles';
import { ProductPicker, type BundleItemDraft } from '../components/product-picker';
import { StoreMultiSelect } from '../components/store-multi-select';

/**
 * Bundle edit page. F4: full form wired to PUT /admin/bundles/:id, POST
 * items, POST stores, POST publish (with dry-run before flipping state).
 *
 * Item persistence in F4 is coarse: on save the page updates Bundle
 * fields + store_ids in a single PUT. Item mutations (add / remove /
 * quantity change) route through the dedicated /items endpoints via
 * onSave dispatching per-diff calls — kept out of this pass. For now the
 * items picker on this screen is a display; the create flow remains the
 * primary path for shaping the item list. This mirrors what most Medusa
 * native surfaces do: create fills the shape, edit fine-tunes it.
 */
const BundleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation('bundles');
  registerBundlesTranslations(i18n);
  const { data, isPending } = useBundle(id);
  const bundle = data?.bundle;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<BundleItemDraft[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);

  useEffect(() => {
    if (!bundle) return;
    setTitle(bundle.title);
    setDescription(bundle.description ?? '');
    setItems(
      (bundle.items ?? []).map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        position: item.position,
      })),
    );
    const raw = bundle as unknown as { stores?: Array<{ id: string }> };
    setStoreIds((raw.stores ?? []).map((s) => s.id));
  }, [bundle]);

  const updateMutation = useUpdateBundle(id ?? '', {
    onSuccess: () => toast.success('Bundle guardado.'),
    onError: (err) => toast.error(err.message),
  });
  const publishMutation = usePublishBundle(id ?? '', {
    onSuccess: () => toast.success(t('STATUS_PUBLISHED')),
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = useDeleteBundle({
    onSuccess: () => toast.success(t('ACTION_DELETE')),
    onError: (err) => toast.error(err.message),
  });

  if (isPending || !bundle) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Loading…</Text>
      </Container>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({
      title,
      description: description.trim() || null,
      store_ids: storeIds,
    });
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">{bundle.title}</Heading>
          <Text className="text-ui-fg-subtle">
            {t('FIELD_HANDLE')}: {bundle.handle} · {bundle.status}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {t('SAVE_DRAFT')}
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
            {t('ACTION_PUBLISH')}
          </Button>
          <Button
            variant="danger"
            size="small"
            onClick={() => {
              if (!id) return;
              if (!window.confirm(`${t('ACTION_DELETE')}?`)) return;
              deleteMutation.mutate(id);
            }}
          >
            {t('ACTION_DELETE')}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <Heading level="h3">{t('TAB_GENERAL')}</Heading>
          <div>
            <Label htmlFor="edit-bundle-title">{t('FIELD_NAME')}</Label>
            <Input
              id="edit-bundle-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-bundle-description">{t('FIELD_DESCRIPTION')}</Label>
            <Textarea
              id="edit-bundle-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Heading level="h3">{t('TAB_PRODUCTS')}</Heading>
          <ProductPicker value={items} onChange={setItems} />
          <Text className="text-ui-fg-subtle text-xs">
            Cambios en la lista de productos se persisten desde el flujo de creación en F4.
          </Text>
        </section>

        <aside className="space-y-4">
          <Heading level="h3">{t('AVAILABILITY_TITLE')}</Heading>
          <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
        </aside>
      </div>
    </Container>
  );
};

export default BundleDetailPage;
