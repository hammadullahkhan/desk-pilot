/**
 * Plugin manifest contract (manifest.json in each plugin folder).
 * See docs/adr/0002-plugin-manifest-contract.md.
 */
import { z } from "zod";

export const MANIFEST_SCHEMA_VERSION = 1;

export const CapabilitySchema = z.enum(["retrieval", "prompt-template", "tool"]);

export const PluginManifestSchema = z
  .object({
    schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
    id: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/, "id must be kebab-case"),
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver"),
    /** semver range of the host app this plugin supports, e.g. ">=0.1.0 <1.0.0" */
    hostRange: z.string().min(1),
    capabilities: z.array(CapabilitySchema).min(1),
    promptTemplate: z.string().optional(),
    collections: z.array(z.string()).default([]),
  })
  .strict()
  .refine((m) => !m.capabilities.includes("prompt-template") || !!m.promptTemplate, {
    message: "prompt-template capability requires promptTemplate",
    path: ["promptTemplate"],
  });

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
