import { describe, expect, it } from "vitest";
import { type InlineToken, type Token, parseInline, parseMarkdown } from "./markdown-parser";

describe("parseInline", () => {
  it("returns plain text as a single text token", () => {
    expect(parseInline("hello world")).toEqual([{ type: "text", content: "hello world" }]);
  });

  it("returns empty array for empty string", () => {
    expect(parseInline("")).toEqual([]);
  });

  it("parses bold (**text**)", () => {
    expect(parseInline("**bold**")).toEqual([{ type: "bold", children: [{ type: "text", content: "bold" }] }]);
  });

  it("parses bold in the middle of text", () => {
    expect(parseInline("a **bold** b")).toEqual([
      { type: "text", content: "a " },
      { type: "bold", children: [{ type: "text", content: "bold" }] },
      { type: "text", content: " b" },
    ]);
  });

  it("parses italic (*text*)", () => {
    expect(parseInline("*italic*")).toEqual([{ type: "italic", children: [{ type: "text", content: "italic" }] }]);
  });

  it("parses italic in the middle of text", () => {
    expect(parseInline("a *italic* b")).toEqual([
      { type: "text", content: "a " },
      { type: "italic", children: [{ type: "text", content: "italic" }] },
      { type: "text", content: " b" },
    ]);
  });

  it("parses link [text](url)", () => {
    expect(parseInline("[click](https://example.com)")).toEqual([
      { type: "link", children: [{ type: "text", content: "click" }], url: "https://example.com" },
    ]);
  });

  it("parses link in the middle of text", () => {
    expect(parseInline("see [link](http://x.com) here")).toEqual([
      { type: "text", content: "see " },
      { type: "link", children: [{ type: "text", content: "link" }], url: "http://x.com" },
      { type: "text", content: " here" },
    ]);
  });

  it("parses nested bold inside italic is not standard but handles sequentially", () => {
    // *some **bold** text* — italic wraps the whole thing, bold is nested inside
    const result = parseInline("*some **bold** text*");
    expect(result).toEqual([
      {
        type: "italic",
        children: [
          { type: "text", content: "some " },
          { type: "bold", children: [{ type: "text", content: "bold" }] },
          { type: "text", content: " text" },
        ],
      },
    ]);
  });

  it("parses link inside italic", () => {
    const result = parseInline("*[click](http://x.com)*");
    expect(result).toEqual([
      {
        type: "italic",
        children: [{ type: "link", children: [{ type: "text", content: "click" }], url: "http://x.com" }],
      },
    ]);
  });

  it("parses italic inside bold", () => {
    const result = parseInline("**a *b* c**");
    expect(result).toEqual([
      {
        type: "bold",
        children: [
          { type: "text", content: "a " },
          { type: "italic", children: [{ type: "text", content: "b" }] },
          { type: "text", content: " c" },
        ],
      },
    ]);
  });

  it("treats unclosed bold as plain text", () => {
    expect(parseInline("**unclosed")).toEqual([{ type: "text", content: "**unclosed" }]);
  });

  it("treats unclosed italic as plain text", () => {
    expect(parseInline("*unclosed")).toEqual([{ type: "text", content: "*unclosed" }]);
  });

  it("handles multiple bold segments", () => {
    expect(parseInline("**a** and **b**")).toEqual([
      { type: "bold", children: [{ type: "text", content: "a" }] },
      { type: "text", content: " and " },
      { type: "bold", children: [{ type: "text", content: "b" }] },
    ]);
  });

  it("handles link with parentheses in URL", () => {
    expect(parseInline("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))")).toEqual([
      {
        type: "link",
        children: [{ type: "text", content: "wiki" }],
        url: "https://en.wikipedia.org/wiki/Foo_(bar)",
      },
    ]);
  });
});

describe("parseMarkdown", () => {
  it("parses a single paragraph", () => {
    expect(parseMarkdown("hello world")).toEqual([
      { type: "paragraph", content: [{ type: "text", content: "hello world" }] },
    ]);
  });

  it("parses multiple paragraphs separated by empty lines", () => {
    const result = parseMarkdown("first\n\nsecond");
    expect(result).toEqual([
      { type: "paragraph", content: [{ type: "text", content: "first" }] },
      { type: "newline" },
      { type: "newline" },
      { type: "paragraph", content: [{ type: "text", content: "second" }] },
    ]);
  });

  it("parses bullet list with dash", () => {
    const result = parseMarkdown("- one\n- two\n- three");
    expect(result).toEqual([
      {
        type: "bulletList",
        items: [
          { content: [{ type: "text", content: "one" }], indent: 0 },
          { content: [{ type: "text", content: "two" }], indent: 0 },
          { content: [{ type: "text", content: "three" }], indent: 0 },
        ],
      },
    ]);
  });

  it("parses bullet list with asterisk", () => {
    const result = parseMarkdown("* one\n* two");
    expect(result).toEqual([
      {
        type: "bulletList",
        items: [
          { content: [{ type: "text", content: "one" }], indent: 0 },
          { content: [{ type: "text", content: "two" }], indent: 0 },
        ],
      },
    ]);
  });

  it("parses ordered list", () => {
    const result = parseMarkdown("1. first\n2. second\n3. third");
    expect(result).toEqual([
      {
        type: "orderedList",
        items: [
          { content: [{ type: "text", content: "first" }], indent: 0 },
          { content: [{ type: "text", content: "second" }], indent: 0 },
          { content: [{ type: "text", content: "third" }], indent: 0 },
        ],
      },
    ]);
  });

  it("parses blockquote", () => {
    const result = parseMarkdown("> quoted text");
    expect(result).toEqual([{ type: "blockquote", content: [{ type: "text", content: "quoted text" }] }]);
  });

  it("parses nested list with indentation", () => {
    const result = parseMarkdown("- parent\n  - child\n    - grandchild");
    expect(result).toEqual([
      {
        type: "bulletList",
        items: [
          { content: [{ type: "text", content: "parent" }], indent: 0 },
          { content: [{ type: "text", content: "child" }], indent: 1 },
          { content: [{ type: "text", content: "grandchild" }], indent: 2 },
        ],
      },
    ]);
  });

  it("parses inline formatting inside list items", () => {
    const result = parseMarkdown("- **bold** item\n- *italic* item");
    expect(result).toEqual([
      {
        type: "bulletList",
        items: [
          {
            content: [
              { type: "bold", children: [{ type: "text", content: "bold" }] },
              { type: "text", content: " item" },
            ],
            indent: 0,
          },
          {
            content: [
              { type: "italic", children: [{ type: "text", content: "italic" }] },
              { type: "text", content: " item" },
            ],
            indent: 0,
          },
        ],
      },
    ]);
  });

  it("parses inline formatting inside blockquote", () => {
    const result = parseMarkdown("> **bold** and *italic*");
    expect(result).toEqual([
      {
        type: "blockquote",
        content: [
          { type: "bold", children: [{ type: "text", content: "bold" }] },
          { type: "text", content: " and " },
          { type: "italic", children: [{ type: "text", content: "italic" }] },
        ],
      },
    ]);
  });

  it("parses mixed block types", () => {
    const result = parseMarkdown("intro\n\n- item1\n- item2\n\n> quote");
    expect(result).toEqual([
      { type: "paragraph", content: [{ type: "text", content: "intro" }] },
      { type: "newline" },
      { type: "newline" },
      {
        type: "bulletList",
        items: [
          { content: [{ type: "text", content: "item1" }], indent: 0 },
          { content: [{ type: "text", content: "item2" }], indent: 0 },
        ],
      },
      { type: "newline" },
      { type: "blockquote", content: [{ type: "text", content: "quote" }] },
    ]);
  });

  it("handles empty input", () => {
    const result = parseMarkdown("");
    expect(result).toEqual([{ type: "newline" }]);
  });

  it("handles consecutive empty lines", () => {
    const result = parseMarkdown("\n\n");
    expect(result).toEqual([{ type: "newline" }, { type: "newline" }, { type: "newline" }]);
  });

  it("parses paragraph with inline bold", () => {
    const result = parseMarkdown("hello **world**");
    expect(result).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", content: "hello " },
          { type: "bold", children: [{ type: "text", content: "world" }] },
        ],
      },
    ]);
  });
});
