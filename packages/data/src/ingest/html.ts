import { load } from "cheerio";

export interface ParsedCanonicalPage {
  title: string;
  description?: string;
  canonicalUrl?: string;
  text: string;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseCanonicalHtml(html: string): ParsedCanonicalPage {
  const $ = load(html);
  $("script,style,noscript").remove();

  const title = $("h1").first().text().trim() || $("title").text().trim();
  if (!title) {
    throw new Error("Canonical HTML has no title");
  }

  const description = $("meta[name=description]").attr("content")?.trim();
  const canonicalUrl = $("link[rel=canonical]").attr("href")?.trim();
  const mainText = normalizeText($("main,article").first().text());
  const text = mainText || normalizeText($("body").text());

  return {
    title,
    ...(description ? { description } : {}),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    text,
  };
}
