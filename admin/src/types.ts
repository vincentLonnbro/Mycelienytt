export type ArticleSummary = {
  id: number;
  title: string;
  slug: string | null;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
  author_id: number;
  author_name: string;
};

export type Author = {
  id: number;
  name: string;
};