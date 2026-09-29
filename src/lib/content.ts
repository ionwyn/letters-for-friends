export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  marks?: { type: string; attrs?: Record<string, string> }[];
  content?: RichNode[];
};

export type Payload = { title: string; code: string; content: RichNode };

const BLOCKS = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
  "codeBlock",
  "text",
  "image",
  "media",
]);
const MARKS = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
]);
const ASSET_PATH = /^\/api\/assets\/([0-9a-f-]{36})$/i;

export function assetIdFromPath(path: string) {
  return ASSET_PATH.exec(path)?.[1] ?? null;
}

function cleanNode(input: unknown, depth = 0): RichNode {
  if (!input || typeof input !== "object" || depth > 24)
    throw new Error("Invalid document");
  const node = input as Record<string, unknown>;
  if (typeof node.type !== "string" || !BLOCKS.has(node.type))
    throw new Error("Unsupported document element");
  const result: RichNode = { type: node.type };
  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text.length > 50000)
      throw new Error("Invalid text");
    result.text = node.text;
  }
  if (node.type === "heading") {
    const level = (node.attrs as Record<string, unknown> | undefined)?.level;
    result.attrs = {
      level: level === 1 || level === 2 || level === 3 ? level : 2,
    };
  }
  if (node.type === "image" || node.type === "media") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (!attrs || typeof attrs.src !== "string" || !assetIdFromPath(attrs.src))
      throw new Error("Only uploaded media can be embedded");
    if (node.type === "image") {
      result.attrs = {
        src: attrs.src,
        alt: typeof attrs.alt === "string" ? attrs.alt.slice(0, 200) : "",
      };
    } else {
      if (!["video", "audio", "file"].includes(String(attrs.kind)))
        throw new Error("Invalid media kind");
      result.attrs = {
        src: attrs.src,
        kind: String(attrs.kind),
        filename: String(attrs.filename || "Attachment").slice(0, 200),
      };
    }
  }
  if (Array.isArray(node.marks) && node.type === "text") {
    result.marks = node.marks.map((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        !MARKS.has(String((item as { type?: string }).type))
      )
        throw new Error("Invalid formatting");
      const mark = item as { type: string; attrs?: { href?: string } };
      if (mark.type !== "link") return { type: mark.type };
      const href = mark.attrs?.href;
      if (
        typeof href !== "string" ||
        !/^https?:\/\//i.test(href) ||
        href.length > 2048
      )
        throw new Error("Links must use http or https");
      return { type: "link", attrs: { href } };
    });
  }
  if (Array.isArray(node.content))
    result.content = node.content.map((child) => cleanNode(child, depth + 1));
  return result;
}

export function cleanDocument(input: unknown) {
  if (JSON.stringify(input).length > 250000)
    throw new Error("Message is too long");
  const doc = cleanNode(input);
  if (doc.type !== "doc") throw new Error("Invalid document root");
  return doc;
}

export function usedAssets(node: RichNode): string[] {
  const own =
    node.attrs?.src && typeof node.attrs.src === "string"
      ? assetIdFromPath(node.attrs.src)
      : null;
  return [...(own ? [own] : []), ...(node.content ?? []).flatMap(usedAssets)];
}
