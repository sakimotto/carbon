import type { JSONContent } from "@tiptap/react";

/**
 * Recursively extracts unique item mention IDs from a TipTap/ProseMirror JSON document.
 * Handles deeply nested structures including paragraphs, lists, and other block elements.
 */
export function parseMentionsFromDocument(content: JSONContent): string[] {
  const mentionIds = new Set<string>();

  function traverse(node: JSONContent): void {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const child of node) {
        traverse(child);
      }
      return;
    }

    if (node.type === "mention" && node.attrs?.id) {
      mentionIds.add(node.attrs.id);
    }

    if (node.content) {
      traverse(node.content);
    }
  }

  traverse(content);
  return Array.from(mentionIds);
}

export const textToTiptap = (text: string) => {
  const lines = text.split("\n");
  const content = lines.map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line }],
  }));
  return { type: "doc", content };
};
