import sanitizeHtml from 'sanitize-html';

const BLOG_CONTENT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'figcaption',
    'figure', 'font', 'h2', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol', 'p',
    'pre', 's', 'span', 'strike', 'strong', 'sub', 'sup', 'table', 'tbody',
    'td', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    font: ['color', 'size'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      'background-color': [/^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i],
      'color': [/^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i],
      'font-size': [/^(?:\d+(?:\.\d+)?(?:px|em|rem|%))$/i],
      'text-align': [/^(?:left|right|center|justify)$/i],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
};

export function sanitizeBlogContent(content: string | null | undefined): string {
  if (!content) return '';
  if (!/<[a-z][^>]*>/i.test(content)) {
    return content
      .trim()
      .split(/\r?\n\s*\r?\n/)
      .filter(Boolean)
      .map((paragraph) => `<p>${paragraph
        .split(/\r?\n/)
        .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        .join('<br>')}</p>`)
      .join('');
  }
  return sanitizeHtml(content, BLOG_CONTENT_OPTIONS);
}
