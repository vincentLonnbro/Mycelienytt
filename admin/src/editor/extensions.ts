import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Video } from "./Video";

const UploadedImage = Image.extend({
  // Only accept images uploaded through the editor. Pasted images pointing at other
  // websites are dropped, instead of making every later save fail.
  parseHTML() {
    return [{ tag: 'img[src^="/uploads/"]' }];
  },
});

// Everything here must also exist in the API's src/editor/extensions.js.
export const extensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Underline,
  Link.configure({ openOnClick: false }),
  UploadedImage,
  Video,
];