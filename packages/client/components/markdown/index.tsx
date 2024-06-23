import { createEffect, createSignal, on } from "solid-js";
import { styled } from "solid-styled-components";

import "katex/dist/katex.min.css";
import { html } from "property-information";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";

import * as elements from "./elements";
import { injectEmojiSize } from "./emoji/util";
import { handlers } from "./hast";
import { RenderCodeblock } from "./plugins/Codeblock";
import { RenderAnchor } from "./plugins/anchors";
import { RenderChannel, remarkChannels } from "./plugins/channels";
import { RenderCustomEmoji, remarkCustomEmoji } from "./plugins/customEmoji";
import { remarkHtmlToText } from "./plugins/htmlToText";
import { RenderMention, remarkMention } from "./plugins/mentions";
import { passThroughComponents } from "./plugins/remarkRegexComponent";
import {
  RenderSpoiler,
  remarkSpoiler,
  spoilerHandler,
} from "./plugins/spoiler";
import {
  RenderTimestamp,
  remarkTimestamps,
  timestampHandler,
} from "./plugins/timestamps";
import { RenderUnicodeEmoji, remarkUnicodeEmoji } from "./plugins/unicodeEmoji";
import { remarkInsertBreaks, sanitise } from "./sanitise";
import { childrenToSolid } from "./solid-markdown/ast-to-solid";
import { defaults } from "./solid-markdown/defaults";

/**
 * Empty component
 */
const Null = () => null;

/**
 * Custom Markdown components
 */
const components = () => ({
  // uemoji: RenderUnicodeEmoji,
  // cemoji: RenderCustomEmoji,
  // mention: RenderMention,
  // channel: RenderChannel,
  timestamp: RenderTimestamp,
  spoiler: RenderSpoiler,

  a: RenderAnchor,
  p: elements.paragraph,
  h1: elements.heading1,
  h2: elements.heading2,
  h3: elements.heading3,
  h4: elements.heading4,
  h5: elements.heading5,
  h6: elements.heading6,
  pre: RenderCodeblock,
  li: elements.listItem,
  ul: elements.unorderedList,
  ol: elements.orderedList,
  blockquote: elements.blockquote,
  table: elements.table,
  th: elements.tableHeader,
  td: elements.tableElement,
  code: elements.code,
  time: elements.time,

  // Block image elements
  img: Null,
  // Catch literally everything else just in case
  video: Null,
  figure: Null,
  picture: Null,
  source: Null,
  audio: Null,
  script: Null,
  style: Null,
});

/**
 * Unified Markdown renderer
 */
const pipeline = unified()
  .use(remarkParse)
  .use(remarkBreaks)
  .use(remarkGfm)
  .use(remarkMath, {
    // TODO: fork for \[\] support
    singleDollarTextMath: false,
  })
  .use(remarkTimestamps)
  // .use(remarkChannels)
  // .use(remarkMention)
  // .use(remarkUnicodeEmoji)
  // .use(remarkCustomEmoji)
  .use(remarkSpoiler)
  .use(remarkHtmlToText)
  .use(remarkRehype, {
    // passThrough: ["spoiler"] as never[],
    handlers: {
      timestamp: timestampHandler,
      spoiler: spoilerHandler,
    } as never,
    // handlers,
  })
  .use(remarkInsertBreaks)
  .use(rehypeKatex, {
    maxSize: 10,
    maxExpand: 2,
    trust: false,
    strict: false,
    output: "html",
    errorColor: "var(--customColours-error-color)",
  })
  .use(rehypeHighlight);

export interface MarkdownProps {
  /**
   * Content to render
   */
  content?: string;

  /**
   * Whether to prevent big emoji from rendering
   */
  disallowBigEmoji?: boolean;
}

export { TextWithEmoji } from "./emoji/TextWithEmoji";
export { Emoji } from "./emoji/Emoji";

/**
 * Remark renderer component
 */
export function Markdown(props: MarkdownProps) {
  /**
   * Render some given Markdown content
   * @param content content
   */
  function render(content = "") {
    const file = new VFile();
    file.value = sanitise(content);

    const hastNode = pipeline.runSync(pipeline.parse(file), file);

    if (hastNode.type !== "root") {
      throw new TypeError("Expected a `root` node");
    }

    injectEmojiSize(props, hastNode as any);

    return childrenToSolid(
      {
        options: {
          ...defaults,
          components: components(),
        },
        schema: html,
        listDepth: 0,
      },
      hastNode
    );
  }

  // Render once immediately
  const [children, setChildren] = createSignal(render(props.content));

  // If it ever updates, re-render the whole tree:
  createEffect(
    on(
      () => props.content,
      (content) => setChildren(render(content)),
      { defer: true }
    )
  );

  // Give it to Solid:
  return <>{children()}</>;
}
