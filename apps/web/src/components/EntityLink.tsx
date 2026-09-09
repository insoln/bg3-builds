import { useState, type ReactNode } from "react";

function safeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function EntityLink({ href, iconUrl, children }: { href: string | undefined; iconUrl: string | undefined; children: ReactNode }): React.JSX.Element {
  const [failedUrl, setFailedUrl] = useState<string>();
  const safeHref = safeHttpsUrl(href);
  const safeIconUrl = safeHttpsUrl(iconUrl);
  const showIcon = safeIconUrl !== undefined
    && new URL(safeIconUrl).hostname === "bg3.wiki"
    && failedUrl !== safeIconUrl;

  if (!safeHref) return <>{children}</>;
  return <a className="entity-link" href={safeHref} target="_blank" rel="noopener noreferrer">
    {showIcon && <img src={safeIconUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(safeIconUrl)} />}
    {children}
  </a>;
}
