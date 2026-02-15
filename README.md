# Slack Markdown Proxy

A browser extension that automatically converts Markdown-formatted text into Slack's rich text formatting when pasted into the message input field.

Slack uses its own rich text editor (Quill) and does not natively support standard Markdown syntax. This extension detects Markdown on paste and inserts formatted text via Quill's Delta API.

## Supported Formatting

| Markdown | Result | Example |
|---|---|---|
| `**text**` | **Bold** | `**important**` |
| `*text*` | *Italic* | `*note*` |
| `[text](url)` | Link | `[Google](https://google.com)` |
| `- item` / `* item` | Bullet list | `- item 1` |
| `1. item` | Ordered list | `1. step 1` |
| `> text` | Blockquote | `> quoted text` |

- Bullet and ordered lists support nesting (2 spaces per indent level)
- Inline formatting works inside list items and blockquotes
- Nested inline formatting is supported (e.g. `*[text](url)*` produces an italic link)

## Installation

### Prerequisites

- Node.js
- Chrome / Chromium-based browser

### Build

```bash
npm install
npm run build
```

Build output is written to the `dist/` directory.

### Load into Chrome

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `dist/` directory

## Usage

1. Open [app.slack.com](https://app.slack.com/) with the extension installed
2. Paste Markdown-formatted text into the message input field
3. The text is automatically converted to Slack's rich text formatting

You can also call it directly from the DevTools console:

```js
__slackMarkdown("**bold** and *italic* test\n- list 1\n- list 2");
```

## Packaging for Chrome Web Store

```bash
npm run package
```

This builds the project and creates `slack-markdown-proxy.zip` ready for upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Development

```bash
npm run watch   # auto-rebuild on file changes
```

After modifying the source, click the reload button on `chrome://extensions` and refresh the Slack tab.

## Project Structure

```
src/
  markdown-parser.ts   # Markdown to token parser
  page.ts              # Quill Delta conversion + paste intercept
  background.ts        # Script injection into Slack pages
manifest.json          # Chrome extension manifest (MV3)
```

## License

MIT
