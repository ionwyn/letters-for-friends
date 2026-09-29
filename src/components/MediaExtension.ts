import { Node, mergeAttributes } from "@tiptap/core";

export const MediaExtension = Node.create({
  name: "media",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      kind: { default: "file" },
      filename: { default: "Attachment" },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-media]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes);
    const { src, kind, filename } = attrs;
    if (kind === "video")
      return [
        "figure",
        { "data-media": "video" },
        ["video", { controls: "true", preload: "metadata", src }],
      ];
    if (kind === "audio")
      return [
        "figure",
        { "data-media": "audio" },
        ["audio", { controls: "true", preload: "metadata", src }],
      ];
    return [
      "figure",
      { "data-media": "file" },
      ["a", { href: src, download: filename }, `↗ ${filename}`],
    ];
  },
});
