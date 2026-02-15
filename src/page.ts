import { parseMarkdown, Token, InlineToken, ListItem } from './markdown-parser';

/**
 * Find the Quill editor instance from the DOM.
 * Quill stores itself as `container.__quill`.
 */
function getQuill(): any {
  const editor = document.querySelector('.ql-editor[contenteditable="true"]');
  if (!editor) {
    console.error('[slack-markdown-proxy] .ql-editor not found');
    return null;
  }

  const container = editor.closest('.ql-container');
  if (!container) {
    console.error('[slack-markdown-proxy] .ql-container not found');
    return null;
  }

  // Standard Quill: container.__quill
  if ((container as any).__quill) {
    console.log('[slack-markdown-proxy] Found Quill via __quill');
    return (container as any).__quill;
  }

  // Search own properties for a Quill-like object
  for (const key of Object.getOwnPropertyNames(container)) {
    try {
      const val = (container as any)[key];
      if (
        val &&
        typeof val === 'object' &&
        typeof val.insertText === 'function' &&
        typeof val.getSelection === 'function' &&
        typeof val.getLength === 'function'
      ) {
        console.log(`[slack-markdown-proxy] Found Quill via property: ${key}`);
        return val;
      }
    } catch {}
  }

  console.error('[slack-markdown-proxy] Quill instance not found on container');
  return null;
}

/**
 * Build a Quill Delta from parsed tokens.
 * The delta retains `startIndex` characters, then inserts formatted content.
 */
function buildDelta(
  tokens: Token[],
  startIndex: number
): { ops: any[] } {
  const ops: any[] = [];

  if (startIndex > 0) {
    ops.push({ retain: startIndex });
  }

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        ops.push({ insert: token.content });
        break;

      case 'bold':
        ops.push({ insert: token.content, attributes: { bold: true } });
        break;

      case 'italic':
        ops.push({ insert: token.content, attributes: { italic: true } });
        break;

      case 'link':
        ops.push({ insert: token.text, attributes: { link: token.url } });
        break;

      case 'newline':
        ops.push({ insert: '\n' });
        break;

      case 'bulletList':
        for (const item of token.items) {
          pushInlineOps(ops, item.content);
          const bulletAttrs: Record<string, any> = { list: 'bullet' };
          if (item.indent > 0) {
            bulletAttrs.indent = item.indent;
          }
          ops.push({ insert: '\n', attributes: bulletAttrs });
        }
        break;

      case 'orderedList':
        for (const item of token.items) {
          pushInlineOps(ops, item.content);
          const orderedAttrs: Record<string, any> = { list: 'ordered' };
          if (item.indent > 0) {
            orderedAttrs.indent = item.indent;
          }
          ops.push({ insert: '\n', attributes: orderedAttrs });
        }
        break;

      case 'blockquote':
        pushInlineOps(ops, token.content);
        ops.push({ insert: '\n', attributes: { blockquote: true } });
        break;
    }
  }

  return { ops };
}

/**
 * Push inline token ops (text / bold / italic / link) into the ops array.
 */
function pushInlineOps(ops: any[], tokens: InlineToken[]): void {
  for (const token of tokens) {
    switch (token.type) {
      case 'bold':
        ops.push({ insert: token.content, attributes: { bold: true } });
        break;
      case 'italic':
        ops.push({ insert: token.content, attributes: { italic: true } });
        break;
      case 'link':
        ops.push({ insert: token.text, attributes: { link: token.url } });
        break;
      default:
        ops.push({ insert: token.content });
        break;
    }
  }
}

/**
 * Count total inserted characters in a delta.
 */
function countInsertedLength(ops: any[]): number {
  return ops.reduce((sum: number, op: any) => {
    if (typeof op.insert === 'string') return sum + op.insert.length;
    return sum;
  }, 0);
}

/**
 * Main entry point.
 */
function slackMarkdown(markdown: string): void {
  console.log('[slack-markdown-proxy] Parsing markdown...');
  const tokens = parseMarkdown(markdown);
  console.log('[slack-markdown-proxy] Tokens:', tokens);

  const quill = getQuill();
  if (!quill) return;

  // Get cursor position (or end of document)
  const sel = quill.getSelection(true);
  const index = sel ? sel.index : quill.getLength() - 1;

  const delta = buildDelta(tokens, index);
  console.log('[slack-markdown-proxy] Applying delta:', delta);

  quill.updateContents(delta, 'user');

  // Move cursor to end of inserted content
  const insertedLen = countInsertedLength(delta.ops);
  quill.setSelection(index + insertedLen);

  console.log('[slack-markdown-proxy] Done.');
}

/**
 * Detect whether a string contains Markdown formatting.
 * Returns true if any supported Markdown pattern is found.
 */
function looksLikeMarkdown(text: string): boolean {
  // Bullet list: line starting with `- ` or `* `
  if (/^[\t ]*[-*] .+/m.test(text)) return true;
  // Ordered list: line starting with `1. `
  if (/^[\t ]*\d+\. .+/m.test(text)) return true;
  // Blockquote: line starting with `> `
  if (/^[\t ]*> .+/m.test(text)) return true;
  // Bold: **text**
  if (/\*\*.+?\*\*/.test(text)) return true;
  // Italic: *text* (but not **)
  if (/(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/.test(text)) return true;
  // Link: [text](url)
  if (/\[.+?\]\(.+?\)/.test(text)) return true;
  return false;
}

/**
 * Intercept paste events on Slack's Quill editor.
 * If the pasted text looks like Markdown, prevent the default paste
 * and use slackMarkdown() to insert with formatting.
 */
function setupPasteIntercept(): void {
  document.addEventListener(
    'paste',
    (e: ClipboardEvent) => {
      // Only intercept pastes targeting a Quill editor
      const target = e.target as HTMLElement;
      if (!target.closest?.('.ql-editor')) return;

      const text = e.clipboardData?.getData('text/plain');
      if (!text || !looksLikeMarkdown(text)) return;

      e.preventDefault();
      e.stopPropagation();
      console.log('[slack-markdown-proxy] Intercepted paste, applying Markdown formatting');
      slackMarkdown(text);
    },
    true // capture phase — run before Slack's own handler
  );
  console.log('[slack-markdown-proxy] Paste intercept is active.');
}

// Expose to window
(window as any).__slackMarkdown = slackMarkdown;
setupPasteIntercept();
console.log('[slack-markdown-proxy] window.__slackMarkdown is ready (Quill API mode).');
