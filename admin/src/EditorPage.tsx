import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "./api";
import ArticleEditor from "./ArticleEditor";
import type { ArticleFull, Author } from "./types";

export default function EditorPage() {
  const { id } = useParams();
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<ArticleFull>(`/admin/articles/${id}`),
      api<Author[]>("/admin/authors"),
    ])
      .then(([a, au]) => {
        if (cancelled) return;
        setArticle(a);
        setAuthors(au);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError && err.status === 404 ? "Article not found." : err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <p><Link to="/">← All articles</Link></p>
      </>
    );
  }
  if (!article) return <p>Loading…</p>;

  return <ArticleEditor key={article.id} article={article} authors={authors} />;
}