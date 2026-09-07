import type * as React from 'react';
import type { EditorImage } from './types';
type Props = {
    open: boolean;
    onClose: () => void;
    images: EditorImage[];
    productId?: string;
    onSaved?: (assetIds: string[]) => void;
};
export default function ImageEditorModal({ open, onClose, images, productId, onSaved }: Props): React.JSX.Element;
export {};
