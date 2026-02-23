import { describe, expect, it } from "vitest";
import { looksLikeMarkdown } from "./page";

describe("looksLikeMarkdown", () => {
  it("detects bullet list with dash", () => {
    expect(looksLikeMarkdown("- item")).toBe(true);
  });

  it("detects bullet list with asterisk", () => {
    expect(looksLikeMarkdown("* item")).toBe(true);
  });

  it("detects indented bullet list", () => {
    expect(looksLikeMarkdown("  - nested item")).toBe(true);
  });

  it("detects ordered list", () => {
    expect(looksLikeMarkdown("1. first")).toBe(true);
  });

  it("detects indented ordered list", () => {
    expect(looksLikeMarkdown("  1. nested")).toBe(true);
  });

  it("detects blockquote", () => {
    expect(looksLikeMarkdown("> quoted")).toBe(true);
  });

  it("detects bold", () => {
    expect(looksLikeMarkdown("some **bold** text")).toBe(true);
  });

  it("detects italic", () => {
    expect(looksLikeMarkdown("some *italic* text")).toBe(true);
  });

  it("detects link", () => {
    expect(looksLikeMarkdown("[click](https://example.com)")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(looksLikeMarkdown("hello world")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(looksLikeMarkdown("")).toBe(false);
  });

  it("returns false for text with just asterisks (no matching pair)", () => {
    expect(looksLikeMarkdown("5 * 3 = 15")).toBe(false);
  });

  it("detects markdown in multiline text", () => {
    expect(looksLikeMarkdown("plain text\n- item1\n- item2")).toBe(true);
  });

  it("detects bold in multiline text", () => {
    expect(looksLikeMarkdown("line one\n**bold line**")).toBe(true);
  });
});
