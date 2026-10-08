import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";

// Everything here must also exist in the API's src/editor/extensions.js.
// If the editor can produce something the API doesn't know, saving fails with
// "unsupported content". The reverse (the API knowing more) is fine.
export const extensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }), // h1 is reserved for the article title
  Underline,
  Link.configure({ openOnClick: false }),
];