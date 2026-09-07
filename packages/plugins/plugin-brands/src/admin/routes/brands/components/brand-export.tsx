import { ArrowDownTray } from '@medusajs/icons';
import { Button, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerBrandsTranslations } from '../../../translations/brands';

export const BrandExport = () => {
  const { t, i18n } = useTranslation('brands');
  registerBrandsTranslations(i18n);
  const [isExporting, setIsExporting] = useState(false);

  const exportBrands = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/admin/brands/export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const csvText = await response.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `brand_associations_${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t('EXPORT_SUCCESS'));
    } catch (error: any) {
      toast.error(t('EXPORT_ERROR', { msg: error.message }));
      console.error('Brand export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="secondary" size="small" onClick={exportBrands} disabled={isExporting}>
      <ArrowDownTray />
      {isExporting ? t('EXPORT_LOADING') : t('EXPORT_BUTTON')}
    </Button>
  );
};
