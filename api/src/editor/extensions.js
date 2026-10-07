import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Node } from "@tiptap/core";

export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  addAttributes() { return { src: { default: null } }; },
  parseHTML() { return [{ tag: "div[data-video]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-video": "", class: "video-embed" },
      ["iframe", {
        src: HTMLAttributes.src,
        loading: "lazy",
        allowfullscreen: "true",
        referrerpolicy: "strict-origin-when-cross-origin",
      }]];
  },
});

export const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  Underline,
  Link.configure({ openOnClick: false }),
  Image,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight,
  Table, TableRow, TableHeader, TableCell,
  Video,
];