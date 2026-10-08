CREATE TABLE authors (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT,
    picture_url  TEXT
);

CREATE TABLE articles (
    id           SERIAL PRIMARY KEY,
    slug         TEXT UNIQUE,                    
    title        TEXT NOT NULL DEFAULT 'Untitled',
    summary      TEXT,
    image_url    TEXT,
    body_json    JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}',
    body_html    TEXT  NOT NULL DEFAULT '',
    status       TEXT  NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,                    
    CHECK (status = 'draft' OR slug IS NOT NULL)
);

CREATE TABLE article_authors (
    article_id INT      NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    author_id  INT      NOT NULL REFERENCES authors(id),
    PRIMARY KEY (article_id, author_id)
);

CREATE INDEX article_authors_author_idx ON article_authors (author_id);

CREATE TABLE tags (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE article_tags (
  article_id INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     INT NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX article_tags_tag_idx ON article_tags (tag_id);

CREATE INDEX articles_public ON articles (published_at DESC)
    WHERE status = 'published' AND deleted_at IS NULL;

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_set_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

