import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  Toaster,
  toast,
} from '@medusajs/ui';
import { ArrowLeft } from '@medusajs/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import {
  useBlogCategories,
  useBlogPost,
  useCreateBlogPost,
  useUpdateBlogPost,
  type BlogImage,
  type BlogStatus,
  type TiptapDoc,
} from '../../../../hooks/api/blog';
import { registerBlogTranslations } from '../../../../translations/blog';
import { TiptapEditor } from '../../../../components/blog/tiptap-editor';
import { ProductSelector } from '../../../../components/blog/product-selector';
import { SalesChannelMultiSelect } from '@minimalart/mercatto-plugin-runtime/admin';
import { sdk } from '../../../../lib/client';

const getStorefrontUrlFallback = (): string => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_STOREFRONT_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
};

async function setProducts(postId: string, productIds: string[]) {
  await fetch(`/admin/blog-posts/${postId}/products`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_ids: productIds }),
  });
}

const ArticleEditor = () => {
  const { t, i18n } = useTranslation('blog');
  registerBlogTranslations(i18n);
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const isNew = id === 'new';

  const { data, isLoading } = useBlogPost(isNew ? '' : id);
  const { data: catData } = useBlogCategories({ limit: 200 });
  const createMut = useCreateBlogPost();
  const updateMut = useUpdateBlogPost(id);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImage, setCoverImage] = useState<BlogImage | null>(null);
  const [content, setContent] = useState<TiptapDoc | null>(null);
  const [status, setStatus] = useState<BlogStatus>('draft');
  const [categoryId, setCategoryId] = useState<string>('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [salesChannelIds, setSalesChannelIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storefrontUrl, setStorefrontUrl] = useState(getStorefrontUrlFallback());

  // Hydrate from server in edit mode
  useEffect(() => {
    if (isNew || !data) return;
    const p = data.blog_post;
    setTitle(p.title ?? '');
    setSlug(p.slug ?? '');
    setExcerpt(p.excerpt ?? '');
    setCoverImage((p.cover_image as BlogImage) ?? null);
    setContent((p.content as TiptapDoc) ?? null);
    setStatus((p.status as BlogStatus) ?? 'draft');
    setCategoryId(p.category_id ?? '');
    setSeoTitle(p.seo_title ?? '');
    setSeoDescription(p.seo_description ?? '');
    setProductIds(data.product_ids ?? []);
    setSalesChannelIds(p.sales_channel_ids ?? []);
  }, [data, isNew]);

  useEffect(() => {
    fetch('/admin/store-config/storefront-url', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.url) setStorefrontUrl(String(d.url).replace(/\/+$/, ''));
      })
      .catch(() => undefined);
  }, []);

  const handleCover = async (file: File) => {
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const f = res.files?.[0];
      if (f?.url) setCoverImage({ url: f.url, file_id: f.id, alt: title });
    } catch (e: any) {
      toast.error(t('SAVE_ERROR', { msg: e?.message ?? '' }));
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = () => ({
    title: title.trim(),
    slug: slug.trim() || undefined,
    excerpt: excerpt || null,
    cover_image: coverImage,
    content,
    status,
    category_id: categoryId || null,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
  });

  const handleSave = async (): Promise<string | undefined> => {
    if (!title.trim()) {
      toast.error(t('VALIDATION_TITLE_REQUIRED'));
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createMut.mutateAsync(buildPayload());
        await setProducts(created.id, productIds);
        toast.success(t('SAVE_SUCCESS'));
        navigate(`/blog/articles/${created.id}`, { replace: true });
        return created.slug;
      }
      const updated = await updateMut.mutateAsync(buildPayload());
      await setProducts(id, productIds);
      toast.success(t('SAVE_SUCCESS'));
      return updated.slug;
    } catch (e: any) {
      toast.error(t('SAVE_ERROR', { msg: e?.message ?? '' }));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    const savedSlug = await handleSave();
    const target = savedSlug || slug;
    if (target) {
      window.open(`${storefrontUrl}/blog/${target}?preview=1`, '_blank');
    }
  };

  if (!isNew && isLoading) {
    return (
      <Container>
        <Text className="text-ui-fg-subtle">…</Text>
      </Container>
    );
  }

  const categories = catData?.blog_categories ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="transparent" size="small" onClick={() => navigate('/blog/articles')}>
            <ArrowLeft />
          </Button>
          <Heading>{isNew ? t('EDITOR_NEW_TITLE') : title || t('MENU_ARTICLES')}</Heading>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="small" onClick={handlePreview} disabled={saving}>
            {t('EDITOR_PREVIEW')}
          </Button>
          <Button size="small" onClick={handleSave} isLoading={saving}>
            {t('EDITOR_SAVE')}
          </Button>
        </div>
      </Container>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Container className="flex flex-col gap-4">
            <Field label={t('FIELD_TITLE')}>
              <Input
                value={title}
                placeholder={t('FIELD_TITLE_PLACEHOLDER')}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label={t('FIELD_SLUG')} help={t('FIELD_SLUG_HELP')}>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" />
            </Field>
            <Field label={t('FIELD_EXCERPT')}>
              <Textarea
                value={excerpt}
                placeholder={t('FIELD_EXCERPT_PLACEHOLDER')}
                onChange={(e) => setExcerpt(e.target.value)}
              />
            </Field>
          </Container>

          <Container className="flex flex-col gap-2">
            <Label size="small" weight="plus">{t('FIELD_CONTENT')}</Label>
            <TiptapEditor value={content} onChange={setContent} />
          </Container>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Container className="flex flex-col gap-4">
            <Field label={t('FIELD_STATUS')}>
              <div className="flex items-center gap-2">
                <Switch
                  checked={status === 'published'}
                  onCheckedChange={(c) => setStatus(c ? 'published' : 'draft')}
                />
                <Text size="small">
                  {status === 'published' ? t('STATUS_PUBLISHED') : t('STATUS_DRAFT')}
                </Text>
              </div>
            </Field>
            <Field label={t('FIELD_CATEGORY')}>
              <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
                <Select.Trigger>
                  <Select.Value placeholder={t('NONE')} />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="none">{t('NONE')}</Select.Item>
                  {categories.map((c) => (
                    <Select.Item key={c.id} value={c.id}>
                      {c.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <Field label={t('FIELD_COVER')}>
              <CoverImage
                image={coverImage}
                uploading={uploading}
                onUpload={handleCover}
                onRemove={() => setCoverImage(null)}
                uploadLabel={t('UPLOAD')}
                uploadingLabel={t('UPLOADING')}
                removeLabel={t('REMOVE_IMAGE')}
              />
            </Field>
            <div className="border-t pt-4">
              <SalesChannelMultiSelect
                value={salesChannelIds}
                onChange={setSalesChannelIds}
                label="Canales de venta"
                help="Vacío = visible en todos los canales."
              />
            </div>
          </Container>

          <Container className="flex flex-col gap-3">
            <div>
              <Heading level="h3">{t('SECTION_PRODUCTS')}</Heading>
              <Text size="small" className="text-ui-fg-subtle">{t('PRODUCTS_HELP')}</Text>
            </div>
            <ProductSelector value={productIds} onChange={setProductIds} />
          </Container>

          <Container className="flex flex-col gap-4">
            <Heading level="h3">{t('SECTION_SEO')}</Heading>
            <Field label={t('FIELD_SEO_TITLE')}>
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </Field>
            <Field label={t('FIELD_SEO_DESCRIPTION')}>
              <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
            </Field>
          </Container>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label size="small" weight="plus">{label}</Label>
      {children}
      {help ? <Text size="xsmall" className="text-ui-fg-muted">{help}</Text> : null}
    </div>
  );
}

function CoverImage({
  image,
  uploading,
  onUpload,
  onRemove,
  uploadLabel,
  uploadingLabel,
  removeLabel,
}: {
  image: BlogImage | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  uploadLabel: string;
  uploadingLabel: string;
  removeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {image?.url ? (
        <div className="overflow-hidden rounded-lg border border-ui-border-base">
          <img src={image.url} alt="" className="h-36 w-full object-cover" />
        </div>
      ) : null}
      <div className="flex gap-2">
        <label className="inline-flex">
          <Button variant="secondary" size="small" asChild>
            <span>{uploading ? uploadingLabel : uploadLabel}</span>
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
        {image?.url ? (
          <Button variant="transparent" size="small" onClick={onRemove}>
            {removeLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type DetailLoaderData = { breadcrumb: string };

// Resolve the article title for the breadcrumb instead of the raw id.
export async function loader({ params }: LoaderFunctionArgs): Promise<DetailLoaderData> {
  const id = params.id ?? '';
  if (id === 'new') return { breadcrumb: 'Nuevo artículo' };
  try {
    const { blog_post } = await sdk.client.fetch<{ blog_post: { title?: string } }>(
      `/admin/blog-posts/${id}`,
      { method: 'GET' },
    );
    return { breadcrumb: blog_post?.title ?? id };
  } catch {
    return { breadcrumb: id };
  }
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<DetailLoaderData>) => data?.breadcrumb ?? '',
};

export default ArticleEditor;
