import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { Button, clx, FocusModal, IconButton, Input, Label, Tooltip } from '@medusajs/ui';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getLegalEditorExtensions } from '../../../modules/store-config/legal/tiptap-extensions';

type Props = {
  /** HTML actual del documento. */
  value: string;
  /** Emite el HTML en cada cambio. */
  onChange: (html: string) => void;
};

/**
 * Editor de textos legales.
 *
 * Entra y sale HTML, no el JSON de Tiptap — ver el encabezado de
 * `modules/store-config/legal/defaults.ts` para por qué los legales se guardan así y
 * el blog no. El HTML que emite se sanea EN EL BACKEND al guardar; acá no se confía
 * en nada de lo que produzca el editor.
 *
 * Es una copia reducida de `components/blog/tiptap-editor.tsx`, no un import de él, y
 * es deliberado: importarlo ataría la extensión `store-config` a que `blog` esté
 * instalada, y un archivo con dos dueños lo saltea el composer SIN ERROR. La barra de
 * herramientas también es más chica a propósito: sólo lo que `sanitizeLegalHtml`
 * permite, así no hay botón que produzca formato que después desaparece al guardar.
 */
export const LegalHtmlEditor = ({ value, onChange }: Props) => {
  /**
   * Lo último que emitió el propio editor. Distingue un cambio del USUARIO (no hay
   * que re-hidratar) de uno que llega de afuera (sí). Sin esto, el `value` que vuelve
   * del padre en cada tecla dispararía un `setContent` que resetea el cursor.
   */
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    // React 18 + StrictMode (el Vite del admin) monta y desmonta dos veces; sin esto
    // el editor puede quedar destruido y los comandos del toolbar no aplican.
    immediatelyRender: false,
    extensions: getLegalEditorExtensions(),
    content: value ?? '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[180px] px-4 py-3',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? '';
    if (incoming === lastEmitted.current) return;
    // Segunda comparación contra la serialización ACTUAL del editor: el HTML que
    // viene del backend está saneado, no normalizado por Tiptap, así que puede
    // diferir en atributos sin diferir en contenido. Sin esto, un texto guardado y
    // recargado se re-inyectaría en loop.
    if (incoming === editor.getHTML()) return;
    lastEmitted.current = incoming;
    editor.commands.setContent(incoming, false);
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="legal-tiptap rounded-lg border border-ui-border-base bg-ui-bg-field">
      {/* El admin de Medusa no trae @tailwindcss/typography, así que `prose` no
          estiliza nada: los estilos del contenido van a mano para que lo que el
          operador ve mientras escribe se parezca a la página publicada. */}
      <style>{`
        .legal-tiptap .ProseMirror h3{font-size:1.05rem;line-height:1.35;font-weight:600;margin:.9em 0 .3em;}
        .legal-tiptap .ProseMirror h4{font-size:.95rem;line-height:1.4;font-weight:600;margin:.8em 0 .3em;}
        .legal-tiptap .ProseMirror p{margin:.6em 0;line-height:1.65;}
        .legal-tiptap .ProseMirror ul{list-style:disc;padding-left:1.5rem;margin:.6em 0;}
        .legal-tiptap .ProseMirror ol{list-style:decimal;padding-left:1.5rem;margin:.6em 0;}
        .legal-tiptap .ProseMirror li{margin:.2em 0;}
        .legal-tiptap .ProseMirror blockquote{border-left:3px solid var(--border-strong,#d4d4d8);padding-left:.75rem;color:#6b7280;margin:.6em 0;font-style:italic;}
        .legal-tiptap .ProseMirror a{color:var(--fg-interactive,#2563eb);text-decoration:underline;}
        .legal-tiptap .ProseMirror hr{border:0;border-top:1px solid var(--border-base,#e5e7eb);margin:1.2em 0;}
      `}</style>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

const Divider = () => <span className="mx-1 h-5 w-px bg-ui-border-base" />;

function Toolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation('storeConfig');
  const [linkDialog, setLinkDialog] = useState<string | null>(null);

  // `useEditor` por sí solo no re-renderiza el toolbar en cada transacción, así que
  // los botones no reflejarían la selección; `useEditorState` sí.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      h3: editor.isActive('heading', { level: 3 }),
      h4: editor.isActive('heading', { level: 4 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
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
    children: ReactNode;
  }) => (
    <Tooltip content={label}>
      <IconButton
        type="button"
        size="small"
        variant="transparent"
        // `preventDefault` en el mousedown para que el botón no le robe el foco al
        // editor: si lo hiciera, el navegador colapsa la selección y el primer click
        // aplicaría el comando sobre una selección vacía (el clásico "anda al
        // segundo click").
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={clx('text-sm font-medium', { 'bg-ui-bg-base-pressed': active })}
      >
        {children}
      </IconButton>
    </Tooltip>
  );

  const submitLink = (url: string) => {
    const trimmed = url.trim();
    if (trimmed) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    } else {
      // Vacío = quitar el link. Es la única forma de desenlazar sin un botón aparte.
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkDialog(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-ui-border-base px-2 py-1.5">
        <Btn label={t('LEGAL_TB_BOLD')} active={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </Btn>
        <Btn label={t('LEGAL_TB_ITALIC')} active={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </Btn>
        <Btn label={t('LEGAL_TB_UNDERLINE')} active={state?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </Btn>
        <Btn label={t('LEGAL_TB_STRIKE')} active={state?.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </Btn>
        <Divider />
        {/* Arranca en H3, no en H2: el H1 es el campo "Título" de la página y el H2 es
            el NOMBRE de la sección (el encabezado del acordeón). Los dos se editan en
            sus propios campos, así que acá sólo quedan los subtítulos de adentro. */}
        <Btn label={t('LEGAL_TB_H3')} active={state?.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </Btn>
        <Btn label={t('LEGAL_TB_H4')} active={state?.h4} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
          H4
        </Btn>
        <Divider />
        <Btn label={t('LEGAL_TB_BULLET')} active={state?.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </Btn>
        <Btn label={t('LEGAL_TB_ORDERED')} active={state?.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </Btn>
        <Btn label={t('LEGAL_TB_QUOTE')} active={state?.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          ”
        </Btn>
        <Btn label={t('LEGAL_TB_DIVIDER')} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          —
        </Btn>
        <Divider />
        <Btn
          label={t('LEGAL_TB_LINK')}
          active={state?.link}
          onClick={() =>
            setLinkDialog((editor.getAttributes('link').href as string | undefined) ?? '')
          }
        >
          🔗
        </Btn>
      </div>
      <LinkModal
        open={linkDialog !== null}
        initialValue={linkDialog ?? ''}
        onOpenChange={(open) => {
          if (!open) setLinkDialog(null);
        }}
        onSubmit={submitLink}
      />
    </>
  );
}

function LinkModal({
  open,
  initialValue,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initialValue: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => void;
}) {
  const { t } = useTranslation('storeConfig');
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
            <FocusModal.Title>{t('LEGAL_TB_LINK')}</FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-2 px-6 py-4">
            <Label size="small" weight="plus" htmlFor="legal-editor-url">
              {/* Se aclara el relativo porque es el caso más común acá (un `/contact`)
                  y porque un `www.algo.com` sin esquema queda como link roto. */}
              {t('LEGAL_LINK_HELP')}
            </Label>
            <Input
              id="legal-editor-url"
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
              <Button type="submit">{t('LEGAL_LINK_APPLY')}</Button>
            </div>
          </FocusModal.Footer>
        </form>
      </FocusModal.Content>
    </FocusModal>
  );
}

export default LegalHtmlEditor;
