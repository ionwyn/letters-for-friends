"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { uploadPresigned } from "@vercel/blob/client";
import { MediaExtension } from "./MediaExtension";
import type { RichNode } from "@/lib/content";

const linkOptions = {
  HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
};
const viewerExtensions = [
  StarterKit,
  Image,
  Link.configure({ ...linkOptions, openOnClick: true }),
  MediaExtension,
];
const editorExtensions = [
  StarterKit,
  Image,
  Link.configure({ ...linkOptions, openOnClick: false }),
  MediaExtension,
];

export function RichViewer({ content }: { content: RichNode }) {
  const editor = useEditor({
    extensions: viewerExtensions,
    content,
    editable: false,
    immediatelyRender: false,
  });
  useEffect(() => {
    if (editor) editor.commands.setContent(content);
  }, [editor, content]);
  return (
    <div className="letter-body">
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichEditor({
  messageId,
  content,
  onChange,
}: {
  messageId: string;
  content: RichNode;
  onChange: (value: RichNode) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const editor = useEditor({
    extensions: editorExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-label": "Message body", class: "editor-surface" },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichNode),
  });

  async function addFile(file: File) {
    if (!editor) return;
    setUploading(true);
    setError("");
    try {
      const safeName =
        file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ||
        "attachment";
      const id = crypto.randomUUID();
      const blob = await uploadPresigned(
        `messages/${messageId}/${id}/${safeName}`,
        file,
        {
          access: "private",
          handleUploadUrl: "/api/uploads",
          multipart: file.size > 4 * 1024 * 1024,
        },
      );
      const response = await fetch("/api/uploads/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, messageId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Upload could not be saved");
      if (file.type.startsWith("image/"))
        editor
          .chain()
          .focus()
          .setImage({ src: result.src, alt: file.name })
          .run();
      else
        editor
          .chain()
          .focus()
          .insertContent({
            type: "media",
            attrs: {
              src: result.src,
              kind: file.type.startsWith("video/")
                ? "video"
                : file.type.startsWith("audio/")
                  ? "audio"
                  : "file",
              filename: file.name,
            },
          })
          .run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt(
      "Paste a link (https://...)",
      previous || "https://",
    );
    if (href === null) return;
    if (!href) editor.chain().focus().unsetLink().run();
    else if (/^https?:\/\//i.test(href))
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    else setError("Links must start with http:// or https://");
  }

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" aria-label="Formatting tools">
        <button
          type="button"
          className={editor?.isActive("bold") ? "on" : ""}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={editor?.isActive("italic") ? "on" : ""}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={editor?.isActive("heading", { level: 2 }) ? "on" : ""}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading"
        >
          H
        </button>
        <button
          type="button"
          className={editor?.isActive("bulletList") ? "on" : ""}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          ≡
        </button>
        <button
          type="button"
          className={editor?.isActive("blockquote") ? "on" : ""}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          “
        </button>
        <button type="button" onClick={setLink} title="Add link">
          ↗
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          title="Add image, audio, video, or file"
        >
          ＋ Media
        </button>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,application/pdf,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void addFile(file);
          }}
        />
        <span className="toolbar-status">
          {uploading ? "Uploading…" : "Your letter, your words"}
        </span>
      </div>
      <EditorContent editor={editor} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
