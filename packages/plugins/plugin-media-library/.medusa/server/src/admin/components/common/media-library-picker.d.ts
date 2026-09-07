/**
 * Reusable picker backed by the Biblioteca (media-library) module. Lets the user
 * reuse an already-uploaded S3 asset (its public `url`) instead of re-uploading.
 * Used by the email branding card and the Puck Logo/Image blocks.
 */
export declare function MediaLibraryPickerModal({ open, onOpenChange, onPick, title, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (url: string) => void;
    title?: string;
}): import("react").JSX.Element;
export default MediaLibraryPickerModal;
