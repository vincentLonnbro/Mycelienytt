import type { JSONContent } from "@tiptap/react";

export type ArticleSummary = {
  id: number;
  title: string;
  slug: string | null;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
  authors: Author[];
};

export type Author = {
  id: number;
  name: string;
};

export type ArticleFull = {
  id: number;
  slug: string | null;
  status: "draft" | "published";
  title: string;
  summary: string | null;
  image_url: string | null;
  body_json: JSONContent;
  published_at: string | null;
  updated_at: string;
  authors: Author[];
  tags: string[];
};