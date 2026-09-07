import { Button, Drawer } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import type { CurationFormModalProps } from '../../../../../../modules/typesense/types';
import CurationForm from './CurationForm';

const CurationFormDrawer = ({
  isOpen,
  setIsOpen,
  editingId,
  loading,
  formHook,
}: CurationFormModalProps) => {
  const { t } = useTranslation('typesense');

  const handleClose = () => {
    formHook.reset();
    setIsOpen(false);
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <Drawer.Content className="max-w-[720px]">
        <form onSubmit={formHook.handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <Drawer.Header>
            <Drawer.Title>
              {editingId ? t('EDIT_CURATION_TITLE') : t('CREATE_CURATION_TITLE')}
            </Drawer.Title>
          </Drawer.Header>

          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
            <CurationForm editingId={editingId} formHook={formHook} />
          </Drawer.Body>

          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
                {t('CANCEL_BUTTON')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('SAVING_TEXT') : t('SAVE_BUTTON')}
              </Button>
            </div>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  );
};

export default CurationFormDrawer;
