import { type InlineToken, type Token, parseMarkdown } from "./markdown-parser";

/**
 * Find the Quill editor instance from a target element.
 * Walks up from the given element (or falls back to DOM query)
 * to find the `.ql-container` and its Quill instance.
 */
function getQuill(target?: Element): any {
  const editor = target?.closest(".ql-editor") ?? document.querySelector('.ql-editor[contenteditable="true"]');
  if (!editor) {
    console.error("[slack-markdown-proxy] .ql-editor not found");
    return null;
  }

  const container = editor.closest(".ql-container");
  if (!container) {
    console.error("[slack-markdown-proxy] .ql-container not found");
    return null;
  }

  // Standard Quill: container.__quill
  if ((container as any).__quill) {
    console.log("[slack-markdown-proxy] Found Quill via __quill");
    return (container as any).__quill;
  }

  // Search own properties for a Quill-like object
  for (const key of Object.getOwnPropertyNames(container)) {
    try {
      const val = (container as any)[key];
      if (
        val &&
        typeof val === "object" &&
        typeof val.insertText === "function" &&
        typeof val.getSelection === "function" &&
        typeof val.getLength === "function"
      ) {
        console.log(`[slack-markdown-proxy] Found Quill via property: ${key}`);
        return val;
      }
    } catch {}
  }

  console.error("[slack-markdown-proxy] Quill instance not found on container");
  return null;
}

/**
 * Push inline token ops into the ops array.
 * Recursively merges attributes so nested formatting
 * (e.g. *[text](url)* → italic + link) is preserved.
 */
function pushInlineOps(ops: any[], tokens: InlineToken[], inherited: Record<string, any> = {}): void {
  for (const token of tokens) {
    switch (token.type) {
      case "bold":
        pushInlineOps(ops, token.children, { ...inherited, bold: true });
        break;
      case "italic":
        pushInlineOps(ops, token.children, { ...inherited, italic: true });
        break;
      case "link":
        pushInlineOps(ops, token.children, { ...inherited, link: token.url });
        break;
      default: {
        const op: any = { insert: token.content };
        if (Object.keys(inherited).length > 0) {
          op.attributes = { ...inherited };
        }
        ops.push(op);
        break;
      }
    }
  }
}

/**
 * Build a Quill Delta from parsed tokens.
 * The delta retains `startIndex` characters, then inserts formatted content.
 */
function buildDelta(tokens: Token[], startIndex: number): { ops: any[] } {
  const ops: any[] = [];

  if (startIndex > 0) {
    ops.push({ retain: startIndex });
  }

  for (const token of tokens) {
    switch (token.type) {
      case "paragraph":
        pushInlineOps(ops, token.content);
        break;

      case "newline":
        ops.push({ insert: "\n" });
        break;

      case "bulletList":
      case "orderedList": {
        const listType = token.type === "bulletList" ? "bullet" : "ordered";
        for (const item of token.items) {
          pushInlineOps(ops, item.content);
          const attrs: Record<string, any> = { list: listType };
          if (item.indent > 0) {
            attrs.indent = item.indent;
          }
          ops.push({ insert: "\n", attributes: attrs });
        }
        break;
      }

      case "blockquote":
        pushInlineOps(ops, token.content);
        ops.push({ insert: "\n", attributes: { blockquote: true } });
        break;
    }
  }

  return { ops };
}

/**
 * Count total inserted characters in a delta.
 */
function countInsertedLength(ops: any[]): number {
  return ops.reduce((sum: number, op: any) => {
    if (typeof op.insert === "string") return sum + op.insert.length;
    return sum;
  }, 0);
}

/**
 * Main entry point.
 * Optionally accepts a target element to locate the correct Quill instance.
 */
function slackMarkdown(markdown: string, target?: Element): void {
  console.log("[slack-markdown-proxy] Parsing markdown...");
  const tokens = parseMarkdown(markdown);
  console.log("[slack-markdown-proxy] Tokens:", tokens);

  const quill = getQuill(target);
  if (!quill) return;

  // Get cursor position (or end of document)
  const sel = quill.getSelection(true);
  const index = sel ? sel.index : quill.getLength() - 1;

  const delta = buildDelta(tokens, index);
  console.log("[slack-markdown-proxy] Applying delta:", delta);

  quill.updateContents(delta, "user");

  // Move cursor to end of inserted content
  const insertedLen = countInsertedLength(delta.ops);
  quill.setSelection(index + insertedLen);

  console.log("[slack-markdown-proxy] Done.");
}

/**
 * Detect whether a string contains Markdown formatting.
 * Returns true if any supported Markdown pattern is found.
 */
export function looksLikeMarkdown(text: string): boolean {
  // Bullet list: line starting with `- ` or `* `
  if (/^[\t ]*[-*] .+/m.test(text)) return true;
  // Ordered list: line starting with `1. `
  if (/^[\t ]*\d+\. .+/m.test(text)) return true;
  // Blockquote: line starting with `> `
  if (/^[\t ]*> .+/m.test(text)) return true;
  // Bold: **text**
  if (/\*\*.+?\*\*/.test(text)) return true;
  // Italic: *text* (opening * must be followed by non-space)
  if (/(?<!\*)\*(?!\*)(?=\S).+?(?<!\*)\*(?!\*)/.test(text)) return true;
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
    "paste",
    (e: ClipboardEvent) => {
      // Only intercept pastes targeting a Quill editor
      const target = e.target as HTMLElement;
      if (!target.closest?.(".ql-editor")) return;

      const text = e.clipboardData?.getData("text/plain");
      if (!text || !looksLikeMarkdown(text)) return;

      e.preventDefault();
      e.stopPropagation();
      console.log("[slack-markdown-proxy] Intercepted paste, applying Markdown formatting");
      slackMarkdown(text, target);
    },
    true, // capture phase — run before Slack's own handler
  );
  console.log("[slack-markdown-proxy] Paste intercept is active.");
}

// Guard against duplicate injection (SPA re-navigation)
if (typeof window !== "undefined" && !(window as any).__slackMarkdownReady) {
  (window as any).__slackMarkdownReady = true;
  (window as any).__slackMarkdown = slackMarkdown;
  setupPasteIntercept();
  console.log("[slack-markdown-proxy] window.__slackMarkdown is ready (Quill API mode).");
}
