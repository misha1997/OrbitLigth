// Shared parser for the plain-text article body format used by both
// news_articles.body/body_uk and (without placeholders) apod_entries's
// explanation: paragraphs separated by a blank line, with [IMG:n]/[VIDEO:n]
// placeholder lines standing in for inline media (news only). Pulled out of
// pages/NewsArticle.js so the admin editor's live preview renders exactly
// what the public page will — the two must never drift apart.
export function parseArticleBody(body) {
  return (body || "")
    .split("\n\n")
    .map((para) => para.trim())
    .filter(Boolean)
    .map((trimmed) => {
      const imgMatch = trimmed.match(/^\[IMG:(\d+)\]$/);
      if (imgMatch) return { type: "img", position: imgMatch[1] };
      const videoMatch = trimmed.match(/^\[VIDEO:(\d+)\]$/);
      if (videoMatch) return { type: "video", position: videoMatch[1] };
      return { type: "p", text: trimmed };
    });
}

// Self-hosted NASA clips are direct .mp4/.webm files, not a YouTube/Vimeo
// embed page — a real <video> element, not an <iframe>, is what plays them.
export function isVideoFile(src) {
  return /\.(mp4|webm|ogv|ogg)(\?|$)/i.test(src || "");
}
