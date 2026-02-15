export type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'link'; children: InlineToken[]; url: string };

export type ListItem = { content: InlineToken[]; indent: number };

export type Token =
  | { type: 'paragraph'; content: InlineToken[] }
  | { type: 'bulletList'; items: ListItem[] }
  | { type: 'orderedList'; items: ListItem[] }
  | { type: 'blockquote'; content: InlineToken[] }
  | { type: 'newline' };

/**
 * Parse inline content (bold, italic, link, text) from a string.
 * Uses a character-level scanner.
 * Priority: Link → Bold(**) → Italic(*)
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buf = '';
  let i = 0;

  function flushBuf() {
    if (buf.length > 0) {
      tokens.push({ type: 'text', content: buf });
      buf = '';
    }
  }

  while (i < text.length) {
    // Link: [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        // Find matching ')' with nesting support
        let depth = 1;
        let j = closeBracket + 2;
        while (j < text.length && depth > 0) {
          if (text[j] === '(') depth++;
          else if (text[j] === ')') depth--;
          j++;
        }
        if (depth === 0) {
          const linkText = text.slice(i + 1, closeBracket);
          const linkUrl = text.slice(closeBracket + 2, j - 1);
          if (linkText.length > 0 && linkUrl.length > 0) {
            flushBuf();
            tokens.push({ type: 'link', children: parseInline(linkText), url: linkUrl });
            i = j;
            continue;
          }
        }
      }
    }

    // Bold: **text**
    if (text[i] === '*' && text[i + 1] === '*') {
      const boldEnd = text.indexOf('**', i + 2);
      if (boldEnd !== -1) {
        const boldContent = text.slice(i + 2, boldEnd);
        if (boldContent.length > 0) {
          flushBuf();
          tokens.push({ type: 'bold', children: parseInline(boldContent) });
          i = boldEnd + 2;
          continue;
        }
      }
    }

    // Italic: *text* (single *, not part of **)
    if (text[i] === '*' && text[i + 1] !== '*') {
      // Find closing * that is not part of **
      let j = i + 1;
      let found = -1;
      while (j < text.length) {
        if (text[j] === '*' && text[j + 1] !== '*' && text[j - 1] !== '*') {
          found = j;
          break;
        }
        j++;
      }
      if (found !== -1) {
        const italicContent = text.slice(i + 1, found);
        if (italicContent.length > 0) {
          flushBuf();
          tokens.push({ type: 'italic', children: parseInline(italicContent) });
          i = found + 1;
          continue;
        }
      }
    }

    buf += text[i];
    i++;
  }

  flushBuf();
  return tokens;
}

/**
 * Parse a Markdown string into a token list.
 *
 * Supported syntax:
 *   - **bold**
 *   - *italic*
 *   - [text](url) (link)
 *   - `- item` or `* item` (bullet list, consecutive lines grouped)
 *   - `1. item` (ordered list, consecutive lines grouped)
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
      const items: ListItem[] = [];
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

    // Ordered list: lines starting with optional whitespace + `1. `
    const orderedMatch = line.match(/^(\s*)(\d+)\. (.*)$/);
    if (orderedMatch) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)(\d+)\. (.*)$/);
        if (!m) break;
        const indent = Math.floor(m[1].length / 2);
        items.push({ content: parseInline(m[3]), indent });
        i++;
      }
      tokens.push({ type: 'orderedList', items });
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

    // Plain line → paragraph with inline tokens
    tokens.push({ type: 'paragraph', content: parseInline(line) });
    // Add newline after a text line if it's not the last line
    if (i < lines.length - 1) {
      tokens.push({ type: 'newline' });
    }
    i++;
  }

  return tokens;
}
