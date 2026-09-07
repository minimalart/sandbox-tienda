import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import type { Extensions } from '@tiptap/core';

/**
 * Shared Tiptap extension set — the single source of truth for both the admin
 * editor (`@tiptap/react` useEditor) and the storefront's server-side
 * JSON→HTML conversion (`@tiptap/html` generateHTML). Keeping one list ensures
 * what authors write is exactly what renders.
 *
 * Covers the MVP editor scope: headings/paragraphs, bold/italic/underline/
 * strike, color + highlight, bullet/ordered/task lists, quote, separator
 * (horizontalRule from StarterKit), links, images, YouTube/Vimeo embeds and
 * basic tables.
 */
export function getBlogEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, autolink: true }),
    Image,
    Youtube.configure({ controls: true, nocookie: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
