import { parseMarkdown, Token, InlineToken, BulletItem } from './markdown-parser';

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

      case 'newline':
        ops.push({ insert: '\n' });
        break;

      case 'bulletList':
        for (const item of token.items) {
          pushInlineOps(ops, item.content);
          const listAttrs: Record<string, any> = { list: 'bullet' };
          if (item.indent > 0) {
            listAttrs.indent = item.indent;
          }
          ops.push({ insert: '\n', attributes: listAttrs });
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
 * Push inline token ops (text / bold) into the ops array.
 */
function pushInlineOps(ops: any[], tokens: InlineToken[]): void {
  for (const token of tokens) {
    if (token.type === 'bold') {
      ops.push({ insert: token.content, attributes: { bold: true } });
    } else {
      ops.push({ insert: token.content });
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

// Expose to window
(window as any).__slackMarkdown = slackMarkdown;
console.log('[slack-markdown-proxy] window.__slackMarkdown is ready (Quill API mode).');
