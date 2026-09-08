import { load } from "cheerio";

export interface ParsedCanonicalPage {
  title: string;
  description?: string;
  canonicalUrl?: string;
  iconUrl?: string;
  text: string;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseCanonicalHtml(html: string, documentUrl?: string): ParsedCanonicalPage {
  const $ = load(html);
  $("script,style,noscript").remove();

  const title = $("h1").first().text().trim() || $("title").text().trim();
  if (!title) {
    throw new Error("Canonical HTML has no title");
  }

  const description = $("meta[name=description]").attr("content")?.trim();
  const canonicalHref = $("link[rel=canonical]").attr("href")?.trim();
  let canonicalUrl: string | undefined;
  if (canonicalHref) {
    try {
      const url = documentUrl ? new URL(canonicalHref, documentUrl) : new URL(canonicalHref);
      if (url.protocol === "https:" && url.hostname === "bg3.wiki" && !url.port && !url.username && !url.password) {
        canonicalUrl = url.href;
      }
    } catch {
      // Invalid optional metadata must not invalidate imported page text.
    }
  }
  const iconCandidate = $("meta[property='og:image']").attr("content")?.trim();
  let iconUrl: string | undefined;
  if (iconCandidate) {
    try {
      const url = canonicalUrl ? new URL(iconCandidate, canonicalUrl) : new URL(iconCandidate);
      if (url.protocol === "https:" && url.hostname === "bg3.wiki" && !url.port && !url.username && !url.password) {
        iconUrl = url.href;
      }
    } catch {
      // Invalid optional metadata must not invalidate imported page text.
    }
  }
  const mainText = normalizeText($("main,article").first().text());
  const text = mainText || normalizeText($("body").text());

  return {
    title,
    ...(description ? { description } : {}),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(iconUrl ? { iconUrl } : {}),
    text,
  };
}
