import { ArrowDownTray, ArrowUpTray, XMark } from '@medusajs/icons';
import { Button, Drawer, Heading, Text, toast } from '@medusajs/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { brandQueryKey } from '../../../hooks/api/brands';
import { sdk } from '../../../lib/client';
import { registerBrandsTranslations } from '../../../translations/brands';

interface CSVRow {
  product_handle: string;
  variant_sku?: string;
  brand_handle: string;
}

interface ProcessResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export const BrandCSVBulk = () => {
  const { t, i18n } = useTranslation('brands');
  registerBrandsTranslations(i18n);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = ['product_handle', 'variant_sku', 'brand_handle'];
    const exampleRow = ['my-product-handle', 'SKU-001', 'my-brand-handle'];

    const csvContent = [
      headers.join(','),
      exampleRow.join(','),
      '# product_handle or variant_sku is used to identify the product',
      '# brand_handle must match an existing brand handle',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'brand_bulk_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('BULK_TEMPLATE_DOWNLOADED'));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error(t('BULK_INVALID_FILE'));
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));

    if (lines.length === 0) throw new Error('CSV file is empty');

    const headers = lines[0]!.split(',').map((h) => h.trim());
    const requiredHeaders = ['brand_handle'];
    const hasValidHeaders = requiredHeaders.every((h) => headers.includes(h));

    if (!hasValidHeaders) {
      throw new Error(
        `Invalid CSV headers. Required: brand_handle. Optional: product_handle, variant_sku`
      );
    }

    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const values = line.split(',').map((v) => v.trim());
      if (values.length < headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row as CSVRow);
    }

    return rows;
  };

  const processCSV = async () => {
    if (!file) {
      toast.error(t('BULK_NO_FILE'));
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error(t('BULK_NO_ROWS'));
        setIsProcessing(false);
        return;
      }

      const response = await sdk.client.fetch<ProcessResult>('/admin/brands/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { items: rows },
      });

      if (!response) throw new Error('No response from server');

      setResult(response);

      if (response.failed === 0) {
        toast.success(t('BULK_LINK_SUCCESS', { count: response.success }));
        queryClient.invalidateQueries({ queryKey: brandQueryKey.lists() });
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 2000);
      } else {
        toast.warning(
          t('BULK_PROCESS_WITH_ERRORS', {
            success: response.success,
            failed: response.failed,
          })
        );
      }
    } catch (error: any) {
      toast.error(t('BULK_PROCESS_ERROR', { msg: error.message }));
      console.error('Brand CSV bulk error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          <ArrowUpTray />
          {t('BULK_TRIGGER')}
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading>{t('BULK_TITLE')}</Heading>
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            {/* Step 1: Instructions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold">
                  1
                </div>
                <Heading level="h3" className="text-base font-semibold text-ui-fg-base">
                  {t('BULK_STEP1_TITLE')}
                </Heading>
              </div>
              <div className="ml-8 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-ui-fg-muted mt-0.5">→</span>
                  <Text className="text-sm text-ui-fg-muted">{t('BULK_STEP1_LINE1')}</Text>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ui-fg-muted mt-0.5">→</span>
                  <Text className="text-sm text-ui-fg-muted">{t('BULK_STEP1_LINE2')}</Text>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ui-fg-muted mt-0.5">→</span>
                  <Text className="text-sm text-ui-fg-muted">{t('BULK_STEP1_LINE3')}</Text>
                </div>
                <div className="mt-3 p-3 bg-ui-bg-subtle border border-ui-border-base rounded">
                  <Text className="text-xs text-ui-fg-muted">
                    <strong className="text-ui-fg-base">{t('BULK_SMART_UPDATE_LABEL')}</strong>{' '}
                    {t('BULK_SMART_UPDATE_TEXT')}
                  </Text>
                </div>
              </div>
            </div>

            {/* Step 2: Download Template */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold">
                  2
                </div>
                <Heading level="h3" className="text-base font-semibold text-ui-fg-base">
                  {t('BULK_STEP2_TITLE')}
                </Heading>
              </div>
              <div className="ml-8">
                <Button variant="secondary" onClick={downloadTemplate} className="w-full sm:w-auto">
                  <ArrowDownTray />
                  {t('BULK_DOWNLOAD_TEMPLATE')}
                </Button>
              </div>
            </div>

            {/* Step 3: Upload File */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold">
                  3
                </div>
                <Heading level="h3" className="text-base font-semibold text-ui-fg-base">
                  {t('BULK_STEP3_TITLE')}
                </Heading>
              </div>
              <div className="ml-8">
                <div className="border-2 border-dashed border-ui-border-base rounded-lg p-6 hover:border-ui-border-strong transition-colors bg-ui-bg-subtle">
                  <input
                    ref={fileInputRef}
                    id="brand-csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="brand-csv-file"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <ArrowUpTray className="w-10 h-10 text-ui-fg-muted mb-3" />
                    <Text className="text-sm font-medium text-ui-fg-base mb-1">
                      {t('BULK_UPLOAD_CLICK')}
                    </Text>
                    <Text className="text-xs text-ui-fg-muted">{t('BULK_UPLOAD_DRAG')}</Text>
                  </label>
                </div>
                {file && (
                  <div className="mt-3 p-3 bg-ui-bg-subtle border border-ui-border-base rounded flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-ui-fg-base">✓</span>
                      <div>
                        <Text className="text-sm font-medium text-ui-fg-base">{file.name}</Text>
                        <Text className="text-xs text-ui-fg-muted">
                          {(file.size / 1024).toFixed(2)} KB
                        </Text>
                      </div>
                    </div>
                    <button
                      onClick={resetForm}
                      className="text-ui-fg-error hover:text-ui-fg-error transition-colors"
                      title={t('BULK_REMOVE_FILE')}
                    >
                      <XMark className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            {result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold">
                    ✓
                  </div>
                  <Heading level="h3" className="text-base font-semibold text-ui-fg-base">
                    {t('BULK_RESULTS_TITLE')}
                  </Heading>
                </div>
                <div className="ml-8 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-ui-bg-subtle border border-ui-border-base rounded">
                      <Text className="text-sm font-bold text-ui-fg-muted mb-1">
                        {t('BULK_RESULTS_SUCCESS')}
                      </Text>
                      <Text className="text-2xl font-bold text-ui-fg-base">{result.success}</Text>
                    </div>
                    <div className="p-4 bg-ui-bg-subtle border border-ui-border-base rounded">
                      <Text className="text-sm font-bold text-ui-fg-muted mb-1">
                        {t('BULK_RESULTS_FAILED')}
                      </Text>
                      <Text className="text-2xl font-bold text-ui-fg-base">{result.failed}</Text>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="p-4 bg-ui-bg-subtle border border-ui-border-base rounded">
                      <Text className="text-sm font-semibold text-ui-fg-base mb-2">
                        {t('BULK_ERROR_DETAILS')}
                      </Text>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {result.errors.map((err, idx) => (
                          <div key={idx} className="text-xs text-ui-fg-muted flex gap-2">
                            <span className="font-medium text-ui-fg-base">
                              {t('BULK_ROW', { row: err.row })}
                            </span>
                            <span>{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Drawer.Body>
        <Drawer.Footer className="flex gap-2">
          <Drawer.Close asChild>
            <Button variant="secondary" onClick={resetForm}>
              {t('CANCEL')}
            </Button>
          </Drawer.Close>
          <Button
            onClick={processCSV}
            isLoading={isProcessing}
            disabled={!file}
            className="flex-1 sm:flex-none"
          >
            {isProcessing ? t('BULK_SUBMIT_LOADING') : t('BULK_SUBMIT')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
