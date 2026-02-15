# Slack Markdown 代理入力 Chrome 拡張 - 実装計画

## Context

Slack のウェブアプリ (app.slack.com) の最近のアップデートにより、Markdown をコピペするとスタイルが壊れるようになった。Slack のエディタ (Quill.js ベース) に直接キーボード入力をエミュレートすることで、箇条書き・太字・引用のスタイルを維持したまま Markdown テキストを入力する Chrome 拡張を作る。

## 技術的背景

- Slack のエディタは **Quill.js のカスタムフォーク** (`contenteditable` div、`.ql-editor` セレクタ)
- Quill インスタンスは `document.querySelector('.ql-container').__quill` で取得可能
- `quill.updateContents(delta, 'user')` で内部状態（Delta）を直接更新できる

---

## PoC 実装で判明した技術的制約

### 試行 1: `world: "MAIN"` で content script を直接実行 → NG

- `manifest.json` の `content_scripts` に `"world": "MAIN"` を指定
- **結果**: スクリプトが実行されなかった（`console.log` が出力されない）
- **原因**: 不明。Slack 側の CSP またはブラウザの挙動の可能性

### 試行 2: ISOLATED world + インライン `<script>` 注入 → NG

- Content script を ISOLATED world（デフォルト）で実行
- `document.createElement('script')` + `script.textContent = code` で page context にヘルパー関数を注入
- **結果**: `window.__slackMarkdown is not a function`
- **原因**: Slack の CSP がインラインスクリプトをブロック

### 試行 3: Background Service Worker + `chrome.scripting.executeScript` → OK ✅

- Background service worker が `chrome.tabs.onUpdated` で Slack タブを検知
- `chrome.scripting.executeScript({ world: 'MAIN', files: ['page.js'] })` でスクリプトを注入
- **結果**: MAIN world でコードが実行され、Quill インスタンスにもアクセスできる

### 試行 4: 合成 `KeyboardEvent` によるフォーマットショートカット → NG

- `editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }))` など
- **結果**: 書式は一切反映されない
- **原因**: `isTrusted: false` のため Slack のカスタム Quill が無視

### 試行 5: `execCommand` によるフォーマット → 部分的に OK / 根本的問題あり

- `execCommand('insertText')`: テキスト挿入 ✅
- `execCommand('bold')`: 見た目上は太字適用 ✅
- `execCommand('insertUnorderedList')`, `execCommand('formatBlock')`, `execCommand('insertParagraph')`: 見た目上は動作
- **しかし**: `execCommand` は DOM のみ変更し、**Quill の内部状態（Delta）を更新しない**
- **結果**: 投稿すると最初のテキストしか送信されず、選択・削除も正常に動作しない ❌

### 試行 6: Quill API 直接操作（`quill.updateContents`） → OK ✅

- MAIN world で `container.__quill` から Quill インスタンスを取得
- `quill.updateContents(delta, 'user')` で Delta を一括適用
- **結果**: 太字・箇条書き・引用が正しく投稿される ✅

### 確定した事実

| 操作 | 方法 | 結果 |
|------|------|------|
| スクリプト注入 | `chrome.scripting.executeScript` (MAIN world, files) | ✅ |
| スクリプト注入 | `content_scripts` + `world: "MAIN"` | ❌ |
| スクリプト注入 | インライン `<script>` | ❌ CSP |
| テキスト挿入 | `execCommand('insertText')` | ✅ (DOM のみ) |
| 書式適用 | 合成 `KeyboardEvent` | ❌ isTrusted |
| 書式適用 | `execCommand('bold')` 等 | ⚠️ DOM のみ、Quill 内部状態と不整合 |
| 書式適用 | `quill.updateContents(delta)` | ✅ 完全に動作 |
| Quill 取得 | `container.__quill` | ✅ |

---

## Phase 1: PoC ✅ 完了

DevTools コンソールから `window.__slackMarkdown(md)` を呼び出して、Slack エディタに Markdown を書式付きで入力できることを確認した。

### 最終アーキテクチャ

```
slack-markdown-proxy/
├── manifest.json              # Manifest V3, background service worker のみ
├── package.json               # esbuild + TypeScript
├── tsconfig.json
├── src/
│   ├── background.ts          # Service worker: Slack タブに page.js を MAIN world で注入
│   ├── page.ts                # MAIN world: Markdown パース + Quill API で書式適用
│   └── markdown-parser.ts     # Markdown → トークン列
└── dist/                      # ビルド出力
```

**実行フロー:**
```
DevTools console (MAIN world)
  → window.__slackMarkdown(md)
    → parseMarkdown(md) → Token[]
    → getQuill() → container.__quill
    → buildDelta(tokens, cursorIndex) → { ops: [...] }
    → quill.updateContents(delta, 'user')
    → quill.setSelection(endIndex)
```

### 対応する Markdown 記法

| 記法 | Quill Delta attribute |
|------|----------------------|
| `**text**` | `{ bold: true }` |
| `- item` / `* item` | `'\n'` に `{ list: 'bullet' }` |
| `> text` | `'\n'` に `{ blockquote: true }` |

---

## Phase 3: コピペのインターセプト ✅ 完了

Slack エディタ（`.ql-editor`）への `paste` イベントを capture phase でリッスンし、クリップボードのテキストに Markdown パターン（箇条書き・引用・太字）が含まれる場合にデフォルトのペーストを抑止して `slackMarkdown()` で書式付き入力を行う。

### 追加実装

- **ネスト箇条書き対応**: 先頭の空白からインデントレベルを算出（2スペース = 1段）し、Quill Delta の `indent` 属性に反映
- **Markdown 検出ヒューリスティック** (`looksLikeMarkdown`):
  - `^[\t ]*[-*] .+` — 箇条書き
  - `^[\t ]*> .+` — 引用
  - `\*\*.+?\*\*` — 太字

---
