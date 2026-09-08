import { XMLParser } from "fast-xml-parser";

export interface ParsedWikiPage {
  title: string;
  pageId?: string;
  revisionId?: string;
  text: string;
}

interface MediaWikiPage {
  title?: unknown;
  id?: unknown;
  revision?: {
    id?: unknown;
    text?: unknown;
  };
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : String(value);
}

function getRevisionText(revision: MediaWikiPage["revision"]): string {
  if (typeof revision?.text === "object" && revision.text !== null && "#text" in revision.text) {
    return String((revision.text as { "#text"?: unknown })["#text"] ?? "");
  }

  return String(revision?.text ?? "");
}

function parsePage(page: MediaWikiPage): ParsedWikiPage {
  const pageId = optionalString(page.id);
  const revisionId = optionalString(page.revision?.id);

  return {
    title: String(page.title ?? "").trim(),
    ...(pageId === undefined ? {} : { pageId }),
    ...(revisionId === undefined ? {} : { revisionId }),
    text: getRevisionText(page.revision),
  };
}

export function parseMediaWikiXml(xml: string): ParsedWikiPage[] {
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml) as {
    mediawiki?: { page?: MediaWikiPage | MediaWikiPage[] };
  };
  const rawPages = parsed.mediawiki?.page;

  if (rawPages === undefined) {
    return [];
  }

  const pages = Array.isArray(rawPages) ? rawPages : [rawPages];
  return pages.map(parsePage).filter((page) => Boolean(page.title));
}
