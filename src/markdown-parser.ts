export type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string };

export type BulletItem = { content: InlineToken[]; indent: number };

export type Token =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'bulletList'; items: BulletItem[] }
  | { type: 'blockquote'; content: InlineToken[] }
  | { type: 'newline' };

/**
 * Parse inline content (bold and text) from a string.
 * Handles **bold** markers within a line.
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const boldStart = remaining.indexOf('**');
    if (boldStart === -1) {
      tokens.push({ type: 'text', content: remaining });
      break;
    }

    if (boldStart > 0) {
      tokens.push({ type: 'text', content: remaining.slice(0, boldStart) });
    }

    const boldEnd = remaining.indexOf('**', boldStart + 2);
    if (boldEnd === -1) {
      // No closing **, treat as plain text
      tokens.push({ type: 'text', content: remaining.slice(boldStart) });
      break;
    }

    const boldContent = remaining.slice(boldStart + 2, boldEnd);
    if (boldContent.length > 0) {
      tokens.push({ type: 'bold', content: boldContent });
    }
    remaining = remaining.slice(boldEnd + 2);
  }

  return tokens;
}

/**
 * Parse a Markdown string into a token list.
 *
 * Supported syntax:
 *   - **bold**
 *   - `- item` or `* item` (bullet list, consecutive lines grouped)
 *   - `> text` (blockquote)
 *   - Plain text
 */
export function parseMarkdown(markdown: string): Token[] {
  const lines = markdown.split('\n');
  const tokens: Token[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Bullet list: lines starting with optional whitespace + `- ` or `* `
    const bulletMatch = line.match(/^(\s*)([-*]) (.*)$/);
    if (bulletMatch) {
      const items: BulletItem[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]) (.*)$/);
        if (!m) break;
        const indent = Math.floor(m[1].length / 2);
        items.push({ content: parseInline(m[3]), indent });
        i++;
      }
      tokens.push({ type: 'bulletList', items });
      continue;
    }

    // Blockquote: line starting with `> `
    const quoteMatch = line.match(/^> (.*)$/);
    if (quoteMatch) {
      tokens.push({ type: 'blockquote', content: parseInline(quoteMatch[1]) });
      i++;
      continue;
    }

    // Empty line → newline token
    if (line === '') {
      tokens.push({ type: 'newline' });
      i++;
      continue;
    }

    // Plain line → parse inline tokens and flatten
    const inlineTokens = parseInline(line);
    for (const t of inlineTokens) {
      tokens.push(t);
    }
    // Add newline after a text line if it's not the last line
    if (i < lines.length - 1) {
      tokens.push({ type: 'newline' });
    }
    i++;
  }

  return tokens;
}
