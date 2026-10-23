import { useState } from "react";

export const DEFAULT_NEWS_IMAGE = "/news-preview.svg";

// Track the failed URL so a reused card can load a different article's photo.
export default function NewsImage({ src, alt = "", loading = "lazy", ...props }) {
  const source = typeof src === "string" ? src.trim() : "";
  const [failedSource, setFailedSource] = useState(null);
  return (
    <img
      {...props}
      src={source && source !== failedSource ? source : DEFAULT_NEWS_IMAGE}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => { if (source !== failedSource) setFailedSource(source); }}
    />
  );
}
