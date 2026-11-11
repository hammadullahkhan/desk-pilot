import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import semver from "semver";
import { PluginManifest, PluginManifestSchema } from "../../shared/manifest";
import type { PluginSummary } from "../../shared/contracts";

export interface RegistryIssue {
  folder: string;
  reason: string;
}

export interface LoadResult {
  plugins: PluginManifest[];
  issues: RegistryIssue[];
}

/**
 * Discovers plugin manifests on disk, validates them against the manifest contract,
 * and rejects plugins that are invalid, duplicated, or incompatible with the host version.
 * Invalid plugins never crash the host; they are reported as issues.
 */
export class PluginRegistry {
  private readonly byId = new Map<string, PluginManifest>();

  constructor(private readonly hostVersion: string) {}

  load(pluginsDir: string): LoadResult {
    const issues: RegistryIssue[] = [];
    if (!existsSync(pluginsDir)) return { plugins: [], issues };

    for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(pluginsDir, entry.name, "manifest.json");
      const result = this.register(entry.name, () => JSON.parse(readFileSync(manifestPath, "utf8")));
      if (result) issues.push(result);
    }
    return { plugins: this.list(), issues };
  }

  register(folder: string, read: () => unknown): RegistryIssue | undefined {
    let raw: unknown;
    try {
      raw = read();
    } catch (err) {
      return { folder, reason: `unreadable manifest: ${(err as Error).message}` };
    }
    const parsed = PluginManifestSchema.safeParse(raw);
    if (!parsed.success) {
      return { folder, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }
    const manifest = parsed.data;
    if (!semver.satisfies(this.hostVersion, manifest.hostRange)) {
      return { folder, reason: `host ${this.hostVersion} not in range ${manifest.hostRange}` };
    }
    if (this.byId.has(manifest.id)) {
      return { folder, reason: `duplicate plugin id ${manifest.id}` };
    }
    this.byId.set(manifest.id, manifest);
    return undefined;
  }

  get(id: string): PluginManifest | undefined {
    return this.byId.get(id);
  }

  list(): PluginManifest[] {
    return [...this.byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  summaries(): PluginSummary[] {
    return this.list().map(({ id, name, version, capabilities }) => ({ id, name, version, capabilities }));
  }
}
