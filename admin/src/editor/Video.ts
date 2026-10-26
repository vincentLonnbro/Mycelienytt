import { Node } from "@tiptap/core";
import { toEmbedUrl } from "../video";

// Must match the API's Video node: same name, group, atom and the "src" attribute.
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        // When pasted HTML contains one of our embeds, read the address from its iframe
        parseHTML: (el: HTMLElement) => {
          const src = el.querySelector("iframe")?.getAttribute("src");
          return src ? toEmbedUrl(src) : null;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-video": "", class: "video-embed" },
      [
        "iframe",
        {
          src: HTMLAttributes.src,
          loading: "lazy",
          allowfullscreen: "true",
          referrerpolicy: "strict-origin-when-cross-origin",
        },
      ],
    ];
  },
});