import { useState, type ComponentPropsWithoutRef } from "react";
import Markdown, { type Components, type UrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const transformUrl: UrlTransform = (value) => safeHttpsUrl(value);

function SafeImage({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = typeof src === "string" ? safeHttpsUrl(src) : null;
  if (!url || new URL(url).hostname !== "bg3.wiki" || failedUrl === url) {
    return alt ? <span className="markdown-image-fallback">{alt}</span> : null;
  }
  return <img {...props} src={url} alt={alt ?? ""} loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />;
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    const url = typeof href === "string" ? safeHttpsUrl(href) : null;
    return url
      ? <a {...props} href={url} target="_blank" rel="noopener noreferrer">{children}</a>
      : <>{children}</>;
  },
  img: SafeImage,
  table: ({ children, ...props }) => <div className="markdown-table-scroll"><table {...props}>{children}</table></div>,
};

export function AssistantMarkdown({ children }: { children: string }) {
  return <div className="assistant-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={transformUrl} components={components}>{children}</Markdown></div>;
}

export function MessageText({ role, text }: { role: "user" | "assistant"; text: string }) {
  return role === "assistant"
    ? <AssistantMarkdown>{text}</AssistantMarkdown>
    : <p className="message__text">{text}</p>;
}
