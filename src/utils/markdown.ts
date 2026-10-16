import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(content: string): string {
  if (!content) return '';
  return marked.parse(content) as string;
}

// Plain-text excerpt of markdown for teasers (no HTML, no markdown syntax).
export function markdownExcerpt(content: string, maxLength = 200): string {
  if (!content) return '';
  const text = content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, text.lastIndexOf(' ', maxLength) > 0 ? text.lastIndexOf(' ', maxLength) : maxLength) + '…';
}
