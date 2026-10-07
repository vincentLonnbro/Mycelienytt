import { Link, useParams } from "react-router-dom";

export default function EditorPage() {
  const { id } = useParams();
  return (
    <>
      <p><Link to="/">← All articles</Link></p>
      <h1>Article {id}</h1>
      <p>Adding TipTap SOOONish</p>
    </>
  );
}