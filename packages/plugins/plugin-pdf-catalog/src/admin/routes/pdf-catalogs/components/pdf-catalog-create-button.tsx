import { Button } from '@medusajs/ui';
import { useState } from 'react';
import { PdfCatalogFormDrawer } from './pdf-catalog-form-drawer';

export const PdfCatalogCreateButton = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
        Crear
      </Button>
      <PdfCatalogFormDrawer catalog={null} open={open} onOpenChange={setOpen} />
    </>
  );
};
