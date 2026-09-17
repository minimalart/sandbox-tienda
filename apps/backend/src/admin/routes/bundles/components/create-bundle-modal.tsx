import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  ProgressTabs,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateBundle } from '../../../hooks/api/bundles';
import { ProductPicker, type BundleItemDraft } from './product-picker';
import { StoreMultiSelect } from './store-multi-select';

interface CreateBundleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'general' | 'products' | 'availability' | 'review';

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/**
 * FocusModal + ProgressTabs para crear un Bundle. Un solo POST /admin/bundles
 * al final con `title + handle + items + store_ids`, así el operador ve el
 * bundle recién creado con toda su configuración en el listado.
 */
export const CreateBundleModal = ({ open, onOpenChange }: CreateBundleModalProps) => {
  const { t } = useTranslation('bundles');
  const [tab, setTab] = useState<Tab>('general');
  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<BundleItemDraft[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);

  const reset = () => {
    setTab('general');
    setTitle('');
    setHandle('');
    setHandleTouched(false);
    setDescription('');
    setItems([]);
    setStoreIds([]);
  };

  const mutation = useCreateBundle({
    onSuccess: () => {
      toast.success(t('SAVE_DRAFT'));
      onOpenChange(false);
      reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const validation = useMemo(() => {
    const problems: string[] = [];
    if (!title.trim()) problems.push('Nombre requerido.');
    if (!HANDLE_PATTERN.test(handle)) problems.push('Handle inválido.');
    if (items.length === 0) problems.push('Agregá al menos un producto.');
    if (items.some((i) => i.quantity < 1)) problems.push('Cantidad inválida.');
    return problems;
  }, [title, handle, items]);

  const canSave = validation.length === 0 && !mutation.isPending;

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!handleTouched) setHandle(slugify(value));
  };

  const handleSubmit = (status: 'draft' | 'published' = 'draft') => {
    if (!canSave) return;
    mutation.mutate({
      title,
      handle,
      description: description.trim() || null,
      status,
      items: items.map((it, idx) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        position: idx,
      })),
      store_ids: storeIds,
    });
  };

  return (
    <FocusModal open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              disabled={!canSave}
              onClick={() => handleSubmit('draft')}
            >
              {t('SAVE_DRAFT')}
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={!canSave}
              onClick={() => handleSubmit('published')}
            >
              {t('PUBLISH_CONFIRM')}
            </Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col">
          <ProgressTabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <ProgressTabs.List>
              <ProgressTabs.Trigger value="general">{t('TAB_GENERAL')}</ProgressTabs.Trigger>
              <ProgressTabs.Trigger value="products">{t('TAB_PRODUCTS')}</ProgressTabs.Trigger>
              <ProgressTabs.Trigger value="availability">
                {t('TAB_AVAILABILITY')}
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value="review">{t('TAB_REVIEW')}</ProgressTabs.Trigger>
            </ProgressTabs.List>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <ProgressTabs.Content value="general">
                <div className="max-w-lg space-y-4">
                  <Heading level="h2">{t('TAB_GENERAL')}</Heading>
                  <div>
                    <Label htmlFor="bundle-title">{t('FIELD_NAME')}</Label>
                    <Input
                      id="bundle-title"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bundle-handle">{t('FIELD_HANDLE')}</Label>
                    <Input
                      id="bundle-handle"
                      value={handle}
                      onChange={(e) => {
                        setHandle(e.target.value.toLowerCase());
                        setHandleTouched(true);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bundle-description">{t('FIELD_DESCRIPTION')}</Label>
                    <Textarea
                      id="bundle-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </ProgressTabs.Content>
              <ProgressTabs.Content value="products">
                <div className="max-w-2xl space-y-4">
                  <Heading level="h2">{t('TAB_PRODUCTS')}</Heading>
                  <ProductPicker value={items} onChange={setItems} />
                </div>
              </ProgressTabs.Content>
              <ProgressTabs.Content value="availability">
                <div className="max-w-2xl space-y-4">
                  <Heading level="h2">{t('AVAILABILITY_TITLE')}</Heading>
                  <p className="text-ui-fg-subtle">{t('AVAILABILITY_HELP')}</p>
                  <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
                </div>
              </ProgressTabs.Content>
              <ProgressTabs.Content value="review">
                <div className="max-w-2xl space-y-4">
                  <Heading level="h2">{t('REVIEW_TITLE')}</Heading>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-ui-fg-subtle">{t('FIELD_NAME')}</dt>
                    <dd>{title || '—'}</dd>
                    <dt className="text-ui-fg-subtle">{t('FIELD_HANDLE')}</dt>
                    <dd>{handle || '—'}</dd>
                    <dt className="text-ui-fg-subtle">{t('REVIEW_STORES')}</dt>
                    <dd>{storeIds.length}</dd>
                    <dt className="text-ui-fg-subtle">{t('REVIEW_PRODUCTS')}</dt>
                    <dd>{items.length}</dd>
                    <dt className="text-ui-fg-subtle">{t('REVIEW_WARNINGS')}</dt>
                    <dd>
                      {validation.length ? (
                        <ul className="list-disc pl-4 text-orange-700">
                          {validation.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-ui-fg-subtle">{t('REVIEW_NO_WARNINGS')}</span>
                      )}
                    </dd>
                  </dl>
                </div>
              </ProgressTabs.Content>
            </div>
          </ProgressTabs>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
};
