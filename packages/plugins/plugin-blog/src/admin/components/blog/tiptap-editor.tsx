import {
  EditorContent,
  useEditor,
  useEditorState,
  type Content,
  type Editor,
} from '@tiptap/react';
import { Button, clx, FocusModal, IconButton, Input, Label, Tooltip } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { getBlogEditorExtensions } from '../../../modules/blog/tiptap-extensions';
import type { TiptapDoc } from '../../hooks/api/blog';
import { sdk } from '../../lib/client';

type Props = {
  value?: TiptapDoc | null;
  onChange: (doc: TiptapDoc) => void;
};

/**
 * Rich text editor for blog articles. Shares its extension set with the
 * server-side HTML renderer (`modules/blog/tiptap-extensions`) so authored
 * content matches what the storefront renders. Emits the Tiptap JSON document
 * on every change. Image uploads go through the Medusa upload API.
 */
export const TiptapEditor = ({ value, onChange }: Props) => {
  const { t } = useTranslation('blog');

  // Guarda el último JSON emitido por el propio editor. Sirve para distinguir
  // un cambio que viene del usuario (no hay que re-hidratar) de uno que llega
  // del server (sí hay que empujarlo con setContent).
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    // React 18 + StrictMode (Vite del admin) monta/desmonta dos veces; sin esto
    // el editor puede quedar destruido y los comandos del toolbar no aplican.
    immediatelyRender: false,
    extensions: getBlogEditorExtensions(),
    content: (value as Content) ?? '',
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as TiptapDoc;
      lastEmitted.current = JSON.stringify(json);
      onChange(json);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[320px] px-4 py-3',
      },
    },
  });

  // Hidratar el editor cuando el contenido llega del server (modo edición).
  // `useEditor({ content })` sólo aplica el valor inicial; al cargar un artículo
  // existente el `value` cambia después del primer render. Sólo re-aplicamos
  // cuando el valor entrante difiere de lo último que emitió el editor: así no
  // pisamos lo que el usuario está tipeando ni reseteamos su selección en cada
  // transacción (lo que hacía que los cambios de formato no se "previsualicen").
  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? null;
    const incomingStr = JSON.stringify(incoming);
    if (incomingStr === lastEmitted.current) return;
    if (incomingStr === JSON.stringify(editor.getJSON())) return;
    lastEmitted.current = incomingStr;
    editor.commands.setContent((incoming as Content) ?? '', false);
  }, [value, editor]);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const res = await sdk.admin.upload.create({ files: [file] });
        const url = res.files?.[0]?.url;
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      } catch {
        // swallow — surfaced by the toaster on the parent on save failures
      }
    },
    [editor],
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="blog-tiptap rounded-lg border border-ui-border-base bg-ui-bg-field">
      {/* El admin de Medusa no incluye @tailwindcss/typography, así que `prose` no
          estiliza nada. Definimos a mano los estilos del contenido para que los
          cambios del editor (H1/H2/H3, listas, cita, etc.) se vean al instante. */}
      <style>{`
        .blog-tiptap .ProseMirror h1{font-size:1.75rem;line-height:1.25;font-weight:700;margin:.7em 0 .35em;}
        .blog-tiptap .ProseMirror h2{font-size:1.4rem;line-height:1.3;font-weight:700;margin:.7em 0 .35em;}
        .blog-tiptap .ProseMirror h3{font-size:1.15rem;line-height:1.35;font-weight:600;margin:.6em 0 .3em;}
        .blog-tiptap .ProseMirror p{margin:.45em 0;}
        .blog-tiptap .ProseMirror ul{list-style:disc;padding-left:1.5rem;margin:.45em 0;}
        .blog-tiptap .ProseMirror ol{list-style:decimal;padding-left:1.5rem;margin:.45em 0;}
        .blog-tiptap .ProseMirror ul[data-type="taskList"]{list-style:none;padding-left:.25rem;}
        .blog-tiptap .ProseMirror ul[data-type="taskList"] li{display:flex;gap:.5rem;align-items:flex-start;}
        .blog-tiptap .ProseMirror blockquote{border-left:3px solid var(--border-strong,#d4d4d8);padding-left:.75rem;color:#6b7280;margin:.5em 0;font-style:italic;}
        .blog-tiptap .ProseMirror a{color:var(--fg-interactive,#2563eb);text-decoration:underline;}
        .blog-tiptap .ProseMirror img{max-width:100%;height:auto;border-radius:.5rem;}
        .blog-tiptap .ProseMirror hr{border:0;border-top:1px solid var(--border-base,#e5e7eb);margin:1em 0;}
        .blog-tiptap .ProseMirror table{border-collapse:collapse;width:100%;margin:.5em 0;}
        .blog-tiptap .ProseMirror th,.blog-tiptap .ProseMirror td{border:1px solid var(--border-base,#e5e7eb);padding:.35rem .5rem;}
        .blog-tiptap .ProseMirror th{background:var(--bg-subtle,#f4f4f5);font-weight:600;}
      `}</style>
      <Toolbar editor={editor} onUploadImage={uploadImage} />
      <EditorContent editor={editor} />
    </div>
  );
};

type ToolbarProps = {
  editor: Editor;
  onUploadImage: (file: File) => void;
};

function Toolbar({ editor, onUploadImage }: ToolbarProps) {
  const { t } = useTranslation('blog');
  const [urlDialog, setUrlDialog] = useState<{
    kind: 'link' | 'video';
    value: string;
  } | null>(null);

  // Deriva el estado "activo" de cada marca/nodo de forma reactiva. `useEditor`
  // por sí solo no garantiza re-render del toolbar en cada transacción, por lo
  // que los botones no reflejaban la selección actual; useEditorState sí.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList: editor.isActive('taskList'),
      blockquote: editor.isActive('blockquote'),
      highlight: editor.isActive('highlight'),
      link: editor.isActive('link'),
    }),
  });

  const Btn = ({
    label,
    active,
    onClick,
    children,
  }: {
    label: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <Tooltip content={label}>
      <IconButton
        type="button"
        size="small"
        variant="transparent"
        // Evita que el botón le robe el foco al editor en el `mousedown`: si lo
        // hiciera, el navegador colapsa la selección de texto y el primer click
        // aplicaría el comando sobre una selección vacía (de ahí que "respondiera
        // al segundo click"). Con preventDefault la selección se conserva y el
        // formato se aplica al primer click.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={clx('text-sm font-medium', {
          'bg-ui-bg-base-pressed': active,
        })}
      >
        {children}
      </IconButton>
    </Tooltip>
  );

  const setLink = () => {
    setUrlDialog({
      kind: 'link',
      value: (editor.getAttributes('link').href as string | undefined) ?? '',
    });
  };

  const addVideo = () => {
    setUrlDialog({ kind: 'video', value: '' });
  };

  const handleUrlSubmit = (url: string) => {
    const trimmed = url.trim();

    if (urlDialog?.kind === 'link') {
      if (trimmed) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
      } else {
        editor.chain().focus().unsetLink().run();
      }
      setUrlDialog(null);
      return;
    }

    if (urlDialog?.kind === 'video' && trimmed) {
      editor.chain().focus().setYoutubeVideo({ src: trimmed }).run();
    }
    setUrlDialog(null);
  };

  const dialogTitle =
    urlDialog?.kind === 'link' ? t('LINK_MODAL_TITLE') : t('VIDEO_MODAL_TITLE');
  const dialogLabel = urlDialog?.kind === 'link' ? t('PROMPT_LINK') : t('PROMPT_VIDEO');
  const dialogSubmit =
    urlDialog?.kind === 'link' ? t('LINK_MODAL_SUBMIT') : t('VIDEO_MODAL_SUBMIT');

  return (
    <>
    <div className="flex flex-wrap items-center gap-0.5 border-b border-ui-border-base px-2 py-1.5">
      <Btn label={t('TB_BOLD')} active={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </Btn>
      <Btn label={t('TB_ITALIC')} active={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </Btn>
      <Btn label={t('TB_UNDERLINE')} active={state?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Btn>
      <Btn label={t('TB_STRIKE')} active={state?.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Btn>
      <Divider />
      <Btn label={t('TB_H1')} active={state?.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </Btn>
      <Btn label={t('TB_H2')} active={state?.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn label={t('TB_H3')} active={state?.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <Divider />
      <Btn label={t('TB_BULLET')} active={state?.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </Btn>
      <Btn label={t('TB_ORDERED')} active={state?.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </Btn>
      <Btn label={t('TB_TASK')} active={state?.taskList} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        ☑
      </Btn>
      <Btn label={t('TB_QUOTE')} active={state?.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ”
      </Btn>
      <Btn label={t('TB_DIVIDER')} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </Btn>
      <Divider />
      <Btn label={t('TB_HIGHLIGHT')} active={state?.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <span className="bg-yellow-200 px-0.5">H</span>
      </Btn>
      <label className="flex h-7 w-7 cursor-pointer items-center justify-center" title={t('TB_COLOR')}>
        <input
          type="color"
          className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      <Divider />
      <Btn label={t('TB_LINK')} active={state?.link} onClick={setLink}>
        🔗
      </Btn>
      <label className="flex h-7 w-7 cursor-pointer items-center justify-center" title={t('TB_IMAGE')}>
        🖼
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadImage(file);
            e.currentTarget.value = '';
          }}
        />
      </label>
      <Btn label={t('TB_VIDEO')} onClick={addVideo}>
        ▶
      </Btn>
      <Btn
        label={t('TB_TABLE')}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        ▦
      </Btn>
    </div>
    <UrlFocusModal
      open={!!urlDialog}
      title={dialogTitle}
      label={dialogLabel}
      submitLabel={dialogSubmit}
      initialValue={urlDialog?.value ?? ''}
      onOpenChange={(open) => {
        if (!open) setUrlDialog(null);
      }}
      onSubmit={handleUrlSubmit}
    />
    </>
  );
}

function UrlFocusModal({
  open,
  title,
  label,
  submitLabel,
  initialValue,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  submitLabel: string;
  initialValue: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => void;
}) {
  const { t } = useTranslation('blog');
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [initialValue, open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value);
  };

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <FocusModal.Header>
            <FocusModal.Title>{title}</FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-2 px-6 py-4">
            <Label size="small" weight="plus" htmlFor="blog-editor-url">
              {label}
            </Label>
            <Input
              id="blog-editor-url"
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t('CANCEL')}
              </Button>
              <Button type="submit">{submitLabel}</Button>
            </div>
          </FocusModal.Footer>
        </form>
      </FocusModal.Content>
    </FocusModal>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-ui-border-base" />;

export default TiptapEditor;
