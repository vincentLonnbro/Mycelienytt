import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";

function Btn(props: {
  label: ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={props.active ? "tb active" : "tb"}
      title={props.title}
      aria-label={props.title}
      aria-pressed={props.active}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the cursor in the text while clicking
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

export default function Toolbar({ editor }: { editor: Editor }) {
  function setLink() {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const input = window.prompt("Link address (leave empty to remove the link)", previous);
    if (input === null) return;
    const url = input.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  const c = () => editor.chain().focus();

  return (
    <div className="format-bar" role="toolbar" aria-label="Formatting">
      <Btn label={<strong>B</strong>} title="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()} />
      <Btn label={<em>I</em>} title="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()} />
      <Btn label={<u>U</u>} title="Underline" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()} />
      <Btn label={<s>S</s>} title="Strikethrough" active={editor.isActive("strike")} onClick={() => c().toggleStrike().run()} />
      <span className="tb-sep" />
      <Btn label="H2" title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Btn label="H3" title="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <span className="tb-sep" />
      <Btn label="• List" title="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()} />
      <Btn label="1. List" title="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()} />
      <Btn label="Quote" title="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()} />
      <Btn label="Code" title="Code block" active={editor.isActive("codeBlock")} onClick={() => c().toggleCodeBlock().run()} />
      <Btn label="—" title="Divider line" onClick={() => c().setHorizontalRule().run()} />
      <span className="tb-sep" />
      <Btn label="Link" title="Add or edit link" active={editor.isActive("link")} onClick={setLink} />
      <span className="tb-sep" />
      <Btn label="Undo" title="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()} />
      <Btn label="Redo" title="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()} />
    </div>
  );
}