import { useState, type KeyboardEvent } from "react";

const MAX_TAGS = 10;

export default function TagInput({
  tags,
  onChange,
  disabled,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    setText("");
    if (!name) return;
    const exists = tags.some((t) => t.toLowerCase() === name.toLowerCase());
    if (!exists && tags.length < MAX_TAGS) onChange([...tags, name]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && tags.length > 0) {
      onChange(tags.slice(0, -1)); // Backspace in an empty box removes the last tag
    }
  }

  return (
    <div className="tag-box">
      {tags.map((t) => (
        <span key={t} className="tag-chip">
          {t}
          <button
            type="button"
            aria-label={`Remove tag ${t}`}
            disabled={disabled}
            onClick={() => onChange(tags.filter((x) => x !== t))}
          >
            ×
          </button>
        </span>
      ))}
      {tags.length < MAX_TAGS && (
        <input
          value={text}
          disabled={disabled}
          placeholder={tags.length === 0 ? "Type a tag and press Enter" : "Add tag…"}
          maxLength={40}
          aria-label="Add a tag"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(text)}
        />
      )}
    </div>
  );
}