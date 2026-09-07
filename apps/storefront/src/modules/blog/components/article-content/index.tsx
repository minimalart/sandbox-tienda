/**
 * Renders the article body. `html` is produced and sanitized server-side by the
 * backend (@tiptap/html + sanitize-html), so it is safe to inject here. The
 * `.blog-content` class applies typographic styles defined in globals.css.
 */
const ArticleContent = ({ html }: { html: string }) => {
  if (!html) return null;
  return (
    <div
      className="blog-content"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default ArticleContent;
