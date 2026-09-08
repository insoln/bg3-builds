import { gameVersionSchema } from "@bg3-builds/domain";
import { z } from "zod";

const manifestEntrySchema = z.object({
  url: z.url(),
  kind: z.enum(["mediawiki-xml", "canonical-html"]),
  gameVersion: gameVersionSchema,
  license: z.string().min(1),
}).strict();

export const urlManifestSchema = z.object({
  entries: z.array(manifestEntrySchema).max(100),
  allowedHosts: z.array(z.string().min(1)).min(1).max(20),
}).strict();

export type UrlManifest = z.infer<typeof urlManifestSchema>;

export function validateUrlManifest(input: unknown): UrlManifest {
  const manifest = urlManifestSchema.parse(input);

  for (const entry of manifest.entries) {
    const url = new URL(entry.url);

    if (url.protocol !== "https:") {
      throw new Error(`Only HTTPS URLs are allowed: ${entry.url}`);
    }
    if (url.username || url.password) {
      throw new Error(`URL credentials are forbidden: ${entry.url}`);
    }
    if (!manifest.allowedHosts.includes(url.hostname)) {
      throw new Error(`Host is not allowlisted: ${url.hostname}`);
    }
  }

  return manifest;
}
