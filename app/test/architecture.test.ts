/**
 * Architectural CI gate: enforces dependency direction between process layers.
 *   renderer -> shared (types only)     preload -> shared     main -> shared
 *   shared   -> nothing app-specific    nobody   -> renderer
 * See docs/adr/0003-ipc-boundary.md.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(__dirname, "..", "src");
const LAYERS = ["main", "preload", "renderer", "shared"] as const;
type Layer = (typeof LAYERS)[number];

const ALLOWED: Record<Layer, Layer[]> = {
  main: ["main", "shared"],
  preload: ["preload", "shared"],
  renderer: ["renderer", "shared"],
  shared: ["shared"],
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

function layerOf(path: string): Layer {
  return relative(SRC, path).split(sep)[0] as Layer;
}

const importRe = /^\s*import\s+(type\s+)?[^'"]*from\s+["']([^"']+)["']/gm;

describe("architecture", () => {
  for (const file of files(SRC)) {
    const from = layerOf(file);
    it(`${relative(SRC, file)} respects layer boundaries`, () => {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(importRe)) {
        const [, typeOnly, spec] = m;
        if (!spec.startsWith(".")) {
          if (from === "renderer" || from === "shared") {
            expect.soft(spec, `${from} must not import runtime package ${spec}`).toMatch(from === "shared" ? /^zod$/ : /^$/);
          }
          continue;
        }
        const target = layerOf(join(file, "..", spec));
        expect(ALLOWED[from], `${from} -> ${target} via ${spec}`).toContain(target);
        if (from === "renderer") expect(typeOnly, "renderer may only import types").toBeTruthy();
      }
    });
  }
});

describe("preload bundle", () => {
  it("preload only imports runtime values from the dependency-free channels module", () => {
    const src = readFileSync(join(SRC, "preload", "preload.ts"), "utf8");
    for (const m of src.matchAll(importRe)) {
      const [, typeOnly, spec] = m;
      if (spec === "electron" || typeOnly) continue;
      expect(spec).toBe("../shared/channels");
    }
  });
});
