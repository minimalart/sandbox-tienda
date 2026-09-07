import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CogSixTooth } from '@medusajs/icons';
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useBlogSettings,
  useUpdateBlogSettings,
} from '../../../hooks/api/blog';
import { registerBlogTranslations } from '../../../translations/blog';

const SettingsPage = () => {
  const { t, i18n } = useTranslation('blog');
  registerBlogTranslations(i18n);

  const { data, isLoading } = useBlogSettings();
  const updateMut = useUpdateBlogSettings();

  const [sectionName, setSectionName] = useState('Blog');
  const [showSearch, setShowSearch] = useState(true);
  const [showCategories, setShowCategories] = useState(true);
  const [postsPerPage, setPostsPerPage] = useState('12');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  useEffect(() => {
    if (!data) return;
    setSectionName(data.section_name ?? 'Blog');
    setShowSearch(data.show_search);
    setShowCategories(data.show_categories);
    setPostsPerPage(String(data.posts_per_page ?? 12));
    setSeoTitle(data.default_seo_title ?? '');
    setSeoDescription(data.default_seo_description ?? '');
  }, [data]);

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        section_name: sectionName.trim() || 'Blog',
        show_search: showSearch,
        show_categories: showCategories,
        posts_per_page: Number(postsPerPage) || 12,
        default_seo_title: seoTitle || null,
        default_seo_description: seoDescription || null,
      });
      toast.success(t('SETTINGS_SAVED'));
    } catch (e: any) {
      toast.error(t('SAVE_ERROR', { msg: e?.message ?? '' }));
    }
  };

  if (isLoading) {
    return (
      <Container>
        <Text className="text-ui-fg-subtle">…</Text>
      </Container>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex items-center justify-between">
        <Heading>{t('SETTINGS_TITLE')}</Heading>
        <Button size="small" onClick={handleSave} isLoading={updateMut.isPending}>
          {t('SAVE')}
        </Button>
      </Container>

      <Container className="flex flex-col gap-4">
        <Heading level="h3">{t('SETTINGS_GENERAL')}</Heading>
        <div className="flex flex-col gap-1.5">
          <Label size="small" weight="plus">{t('FIELD_SECTION_NAME')}</Label>
          <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <Label size="small">{t('FIELD_SHOW_SEARCH')}</Label>
          <Switch checked={showSearch} onCheckedChange={setShowSearch} />
        </div>
        <div className="flex items-center justify-between">
          <Label size="small">{t('FIELD_SHOW_CATEGORIES')}</Label>
          <Switch checked={showCategories} onCheckedChange={setShowCategories} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label size="small" weight="plus">{t('FIELD_POSTS_PER_PAGE')}</Label>
          <Input
            type="number"
            value={postsPerPage}
            onChange={(e) => setPostsPerPage(e.target.value)}
          />
        </div>
      </Container>

      <Container className="flex flex-col gap-4">
        <Heading level="h3">{t('SETTINGS_SEO')}</Heading>
        <div className="flex flex-col gap-1.5">
          <Label size="small" weight="plus">{t('FIELD_DEFAULT_SEO_TITLE')}</Label>
          <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label size="small" weight="plus">{t('FIELD_DEFAULT_SEO_DESCRIPTION')}</Label>
          <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
        </div>
      </Container>
      <Toaster />
    </div>
  );
};

const SettingsIcon = () => <CogSixTooth />;

export const config = defineRouteConfig({
  label: 'Configuración',
  icon: SettingsIcon,
});

export default SettingsPage;
