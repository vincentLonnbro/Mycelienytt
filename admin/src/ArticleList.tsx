import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "./api";
import type { ArticleSummary, Author } from "./types";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export default function ArticleList() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [authorId, setAuthorId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api<ArticleSummary[]>("/admin/articles"),
      api<Author[]>("/admin/authors"),
    ])
      .then(([a, au]) => {
        setArticles(a);
        setAuthors(au);
        if (au.length) setAuthorId(String(au[0].id));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function createArticle() {
    setBusy(true);
    setError("");
    try {
      const { id } = await api<{ id: number }>("/admin/articles", {
        method: "POST",
        body: { author_ids: [Number(authorId)] },
      });
      navigate(`/articles/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the article");
      setBusy(false);
    }
  }

  async function remove(a: ArticleSummary) {
    const ok = window.confirm(
      `Delete "${a.title}"?` + (a.status === "published" ? "\n\nIt is published, so it will go offline." : "")
    );
    if (!ok) return;
    try {
      await api(`/admin/articles/${a.id}`, { method: "DELETE" });
      setArticles((list) => list?.filter((x) => x.id !== a.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the article");
    }
  }

  if (!articles && !error) return <p>Loading…</p>;

  return (
    <>
      <div className="toolbar">
        <h1>Articles</h1>
        {authors.length > 0 && (
          <div className="new-article">
            <label htmlFor="author">Author</label>
            <select id="author" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button className="primary" onClick={createArticle} disabled={busy || !authorId}>
              {busy ? "Creating…" : "New article"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {authors.length === 0 && articles && (
        <p className="notice">
          There are no authors yet. Add one in the database first (see the <code>INSERT INTO authors</code> command),
          then reload this page.
        </p>
      )}

      {articles && articles.length === 0 && authors.length > 0 && (
        <p className="notice">No articles yet. Pick an author and click “New article”.</p>
      )}

      {articles && articles.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Author</th>
                <th>Last updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/articles/${a.id}`}>{a.title || "Untitled"}</Link>
                  </td>
                  <td>
                    <span className={`badge ${a.status}`}>
                      {a.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>{a.authors.map((x) => x.name).join(", ")}</td>
                  <td>{formatDate(a.updated_at)}</td>
                  <td className="actions">
                    <button className="danger" onClick={() => remove(a)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}