import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { api, IMAGE_ACCEPT, uploadImage } from "./api";
import { extensions } from "./editor/extensions";
import Toolbar from "./editor/Toolbar";
import TagInput from "./TagInput";
import { useAutosave, type SaveStatus } from "./useSave";
import type { ArticleFull, Author } from "./types";

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

const imageFiles = (list?: FileList | null) =>
  Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

export default function ArticleEditor({ article, authors }: { article: ArticleFull; authors: Author[] }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(article.title === "Untitled" ? "" : article.title);
  const [authorIds, setAuthorIds] = useState<number[]>(article.authors.map((a) => a.id));
  const [summary, setSummary] = useState(article.summary ?? "");
  const [tags, setTags] = useState<string[]>(article.tags);
  const [cover, setCover] = useState<string | null>(article.image_url);
  const [coverBusy, setCoverBusy] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [live, setLive] = useState({ status: article.status, slug: article.slug });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const coverInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const { status, savedAt, message, markDirty, flush, hasUnsaved, setStamp } = useAutosave({
    url: `/admin/articles/${article.id}`,
    initialStamp: article.updated_at,
    getPayload: () => {
      if (!editor) return null;
      // The API refuses to blank the title of a live article
      if (live.status === "published" && !title.trim()) return null;
      return {
        title: title.trim(),
        author_ids: authorIds,
        summary: summary.trim() || null,
        tags,
        image_url: cover,
        body_json: editor.getJSON(),
      };
    },
  });

  // Used by paste and drag-and-drop. Uploads each image, then inserts it.
  async function addImageFiles(files: File[], pos?: number) {
    setMediaError("");
    for (const file of files) {
      try {
        const { url } = await uploadImage(file);
        const ed = editorRef.current;
        if (!ed) return;
        const chain = ed.chain().focus();
        if (pos !== undefined) chain.setTextSelection(pos);
        chain.setImage({ src: url }).run();
        pos = undefined; // only the first image goes to the drop point
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : "Upload failed");
      }
    }
  }

  const editor = useEditor({
    extensions,
    content: initialContent(article.body_json),
    onUpdate: markDirty,
    editorProps: {
      attributes: { "aria-label": "Article body" },
      handlePaste: (_view, event) => {
        const data = event.clipboardData;
        // Only take over pastes that are purely an image (like a screenshot).
        // Text copied from Word or a web page may carry a picture too; leave those alone.
        if (!data || data.types.includes("text/plain") || data.types.includes("text/html")) return false;
        const files = imageFiles(data.files);
        if (!files.length) return false;
        event.preventDefault();
        void addImageFiles(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false; // moving content inside the editor
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void addImageFiles(files, pos);
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Lock the body while publishing, so nothing is typed between the final save and the publish.
  useEffect(() => {
    editor?.setEditable(!busy, false);
  }, [editor, busy]);

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

  function onSummaryChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setSummary(e.target.value);
    markDirty();
  }

  function onTagsChange(next: string[]) {
    setTags(next);
    markDirty();
  }

  function toggleAuthor(id: number) {
    const next = authorIds.includes(id) ? authorIds.filter((x) => x !== id) : [...authorIds, id];
    if (next.length === 0) return; // an article always keeps at least one author
    setAuthorIds(next);
    markDirty();
  }

  async function onCoverChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMediaError("");
    setCoverBusy(true);
    try {
      const { url } = await uploadImage(file);
      setCover(url);
      markDirty();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setCoverBusy(false);
    }
  }

  function removeCover() {
    setCover(null);
    markDirty();
  }

  async function goBack() {
    const saved = await flush();
    if (saved || window.confirm("Your latest changes could not be saved. Leave anyway?")) {
      navigate("/");
    }
  }

  async function publish() {
    setActionError("");
    setBusy(true);
    try {
      if (!(await flush())) {
        setActionError("Your latest changes could not be saved, so publishing was cancelled.");
        return;
      }
      const res = await api<{ slug: string; status: "published"; updated_at: string }>(
        `/admin/articles/${article.id}/publish`,
        { method: "POST" }
      );
      setStamp(res.updated_at);
      setLive({ status: res.status, slug: res.slug });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!window.confirm("Take this article offline? Readers will no longer be able to see it.")) return;
    setActionError("");
    setBusy(true);
    try {
      if (!(await flush())) {
        setActionError("Your latest changes could not be saved, so the article was not taken offline.");
        return;
      }
      const res = await api<{ status: "draft"; updated_at: string }>(
        `/admin/articles/${article.id}/unpublish`,
        { method: "POST" }
      );
      setStamp(res.updated_at);
      setLive((l) => ({ ...l, status: res.status }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not unpublish.");
    } finally {
      setBusy(false);
    }
  }

  if (!editor) return null;

  return (
    <>
      <div className="editor-top">
        <button type="button" className="link-button" onClick={goBack}>← All articles</button>
        <div className="top-right">
          <span className={`save-status ${status}`} aria-live="polite">
            {statusLabel(status, savedAt, message)}
          </span>
          {live.status === "published" ? (
            <button type="button" onClick={unpublish} disabled={busy}>Unpublish</button>
          ) : (
            <button type="button" className="primary" onClick={publish} disabled={busy || status === "conflict"}>
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="error" role="alert">{actionError}</p>}

      {live.status === "published" ? (
        <p className="notice">
          <strong>Published.</strong> Your edits go live as they autosave. To work on it privately, unpublish it first.
          {live.slug && (
            <>
              {" "}
              <a href={`/api/articles/${live.slug}`} target="_blank" rel="noreferrer">View the live data</a>
            </>
          )}
        </p>
      ) : (
        <p className="notice">Draft. Only people with the admin password can see this.</p>
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
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editor.commands.focus("start");
          }
        }}
      />

      <fieldset className="authors" disabled={busy}>
        <legend>Authors</legend>
        {authors.map((a) => (
          <label key={a.id}>
            <input type="checkbox" checked={authorIds.includes(a.id)} onChange={() => toggleAuthor(a.id)} />
            {a.name}
          </label>
        ))}
      </fieldset>

      <section className="cover">
        <strong>Cover image</strong>
        {cover ? (
          <img src={cover} alt="Cover preview" />
        ) : (
          <p className="muted">No cover image. It is shown in article lists and link previews.</p>
        )}
        <div className="cover-actions">
          <button type="button" onClick={() => coverInput.current?.click()} disabled={busy || coverBusy}>
            {coverBusy ? "Uploading…" : cover ? "Replace" : "Upload cover image"}
          </button>
          {cover && (
            <button type="button" onClick={removeCover} disabled={busy || coverBusy}>Remove</button>
          )}
          <input ref={coverInput} type="file" accept={IMAGE_ACCEPT} hidden onChange={onCoverChosen} />
        </div>
      </section>

      <section className="settings">
        <label htmlFor="summary">Summary</label>
        <textarea
          id="summary"
          rows={3}
          maxLength={500}
          value={summary}
          onChange={onSummaryChange}
          disabled={busy}
          placeholder="Shown in article lists and link previews. If left empty, it is taken from the start of the article."
        />
        <div className="hint">{summary.length}/500</div>

        <label>Tags</label>
        <TagInput tags={tags} onChange={onTagsChange} disabled={busy} />
      </section>

      {mediaError && <p className="error" role="alert">{mediaError}</p>}
      <Toolbar editor={editor} onError={setMediaError} />
      <EditorContent editor={editor} className="editor-surface" />
    </>
  );
}