# Slack Markdown Proxy

Slack のメッセージ入力欄に Markdown 書式のテキストをペーストすると、自動的に Slack のリッチテキスト書式に変換する Chrome 拡張機能です。

Slack は独自のリッチテキストエディタ (Quill) を使用しており、標準の Markdown 記法がそのまま通りません。この拡張機能はペースト時に Markdown を検出し、Quill の Delta API を通じて書式付きテキストとして挿入します。

## 対応している書式

| Markdown | 変換結果 | 例 |
|---|---|---|
| `**text**` | **太字** | `**重要**` |
| `*text*` | *イタリック* | `*注意*` |
| `[text](url)` | リンク | `[Google](https://google.com)` |
| `- item` / `* item` | 箇条書きリスト | `- 項目1` |
| `1. item` | 番号付きリスト | `1. 手順1` |
| `> text` | 引用 | `> 引用文` |

- 箇条書き・番号付きリストはネストに対応しています (2 スペースで 1 段インデント)
- インライン書式はリスト項目や引用の中でも使えます

## インストール

### 前提条件

- Node.js
- Chrome / Chromium 系ブラウザ

### ビルド

```bash
npm install
npm run build
```

`dist/` ディレクトリにビルド成果物が出力されます。

### Chrome への読み込み

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist/` ディレクトリを選択

## 使い方

1. 拡張機能をインストールした状態で [app.slack.com](https://app.slack.com/) を開く
2. Markdown 書式を含むテキストをメッセージ入力欄にペーストする
3. 自動的に Slack のリッチテキスト書式に変換されて入力される

DevTools コンソールから直接呼び出すこともできます:

```js
__slackMarkdown("**太字** と *イタリック* のテスト\n- リスト1\n- リスト2");
```

## 開発

```bash
npm run watch   # ファイル変更時に自動ビルド
```

ソースを変更したら `chrome://extensions` で拡張機能の更新ボタンを押し、Slack タブをリロードしてください。

## プロジェクト構成

```
src/
  markdown-parser.ts   # Markdown → トークン列のパーサー
  page.ts              # Quill Delta 変換 + ペーストインターセプト
  background.ts        # Slack ページへのスクリプト注入
manifest.json          # Chrome 拡張マニフェスト (MV3)
```

## ライセンス

MIT
