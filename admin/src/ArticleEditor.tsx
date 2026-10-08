import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { extensions } from "./editor/extensions";
import Toolbar from "./editor/Toolbar";
import { useAutosave, type SaveStatus } from "./useSave";
import type { ArticleFull, Author } from "./types";

// A brand-new article has no content yet, but the editor needs at least one paragraph
function initialContent(doc: JSONContent): JSONContent {
  return doc.content && doc.content.length > 0 ? doc : { type: "doc", content: [{ type: "paragraph" }] };
}

function statusLabel(status: SaveStatus, savedAt: Date | null, message: string) {
  switch (status) {
    case "saving": return "Saving…";
    case "dirty": return "Unsaved changes…";
    case "blocked": return "A published article needs a title. Saving is paused.";
    case "error": return message || "Could not save.";
    case "conflict": return "Saving stopped.";
    default: return savedAt ? `Saved at ${savedAt.toLocaleTimeString()}` : "No changes yet";
  }
}

export default function ArticleEditor({ article, authors }: { article: ArticleFull; authors: Author[] }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(article.title === "Untitled" ? "" : article.title);
  const [authorIds, setAuthorIds] = useState<number[]>(article.authors.map((a) => a.id));

  const { status, savedAt, message, markDirty, flush, hasUnsaved } = useAutosave({
    url: `/admin/articles/${article.id}`,
    initialStamp: article.updated_at,
    getPayload: () => {
      if (!editor) return null;
      // The API refuses to blank the title of a live article
      if (article.status === "published" && !title.trim()) return null;
      return {
        title: title.trim(),
        author_ids: authorIds,
        body_json: editor.getJSON(),
        // The API overwrites these on every save, so they must be sent back unchanged.
        // They become editable in a later step.
        summary: article.summary,
        image_url: article.image_url,
      };
    },
  });

  const editor = useEditor({
    extensions,
    content: initialContent(article.body_json),
    onUpdate: markDirty,
    editorProps: { attributes: { "aria-label": "Article body" } },
  });

  // Warn before closing the tab or reloading with unsaved changes
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasUnsaved()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  function onTitleChange(e: ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    markDirty();
  }

  function toggleAuthor(id: number) {
    const next = authorIds.includes(id) ? authorIds.filter((x) => x !== id) : [...authorIds, id];
    if (next.length === 0) return; // an article always keeps at least one author
    setAuthorIds(next);
    markDirty();
  }

  async function goBack() {
    const saved = await flush();
    if (saved || window.confirm("Your latest changes could not be saved. Leave anyway?")) {
      navigate("/");
    }
  }

  if (!editor) return null;

  return (
    <>
      <div className="editor-top">
        <button type="button" className="link-button" onClick={goBack}>← All articles</button>
        <span className={`save-status ${status}`} aria-live="polite">
          {statusLabel(status, savedAt, message)}
        </span>
      </div>

      {article.status === "published" && (
        <p className="notice">This article is published. Your edits go live as they autosave.</p>
      )}

      {status === "conflict" && (
        <div className="banner" role="alert">
          <span>
            <strong>This article was changed somewhere else.</strong> Your latest edits were not saved, and
            saving is paused so nothing gets overwritten. Copy anything you want to keep, then reload to see
            the newer version.
          </span>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}

      <input
        className="title-input"
        value={title}
        onChange={onTitleChange}
        placeholder="Untitled"
        maxLength={200}
        aria-label="Title"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editor.commands.focus("start");
          }
        }}
      />

      <fieldset className="authors">
        <legend>Authors</legend>
        {authors.map((a) => (
          <label key={a.id}>
            <input type="checkbox" checked={authorIds.includes(a.id)} onChange={() => toggleAuthor(a.id)} />
            {a.name}
          </label>
        ))}
      </fieldset>

      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="editor-surface" />
    </>
  );
}