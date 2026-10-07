import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { api, setUnauthorizedHandler } from "./api";
import Login from "./Login";
import ArticleList from "./ArticleList";
import EditorPage from "./Editor";

type AuthState = "loading" | "loggedOut" | "loggedIn";

export default function App() {
  const [auth, setAuth] = useState<AuthState>("loading");

  useEffect(() => {
    // Any API call that comes back 401 sends us to the login form
    setUnauthorizedHandler(() => setAuth("loggedOut"));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    api("/auth/me")
      .then(() => setAuth("loggedIn"))
      .catch(() => setAuth("loggedOut"));
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setAuth("loggedOut");
  }

  if (auth === "loading") return <p className="center">Loading…</p>;
  if (auth === "loggedOut") return <Login onSuccess={() => setAuth("loggedIn")} />;

  return (
    <div className="shell">
      <header>
        <Link to="/" className="brand">Article admin</Link>
        <button onClick={logout}>Log out</button>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ArticleList />} />
          <Route path="/articles/:id" element={<EditorPage />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Back to articles</Link></p>} />
        </Routes>
      </main>
    </div>
  );
}