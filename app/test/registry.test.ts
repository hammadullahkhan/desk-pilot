import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { PluginRegistry } from "../src/main/plugins/registry";

const valid = {
  schemaVersion: 1,
  id: "sample-plugin",
  name: "Sample",
  version: "1.0.0",
  hostRange: ">=0.1.0 <1.0.0",
  capabilities: ["retrieval"],
};

describe("PluginRegistry", () => {
  it("loads the bundled plugins", () => {
    const reg = new PluginRegistry("0.1.0");
    const { plugins, issues } = reg.load(join(__dirname, "..", "plugins"));
    expect(issues).toEqual([]);
    expect(plugins.map((p) => p.id)).toEqual(["docs-search", "meeting-notes"]);
  });

  it("accepts a valid manifest", () => {
    const reg = new PluginRegistry("0.1.0");
    expect(reg.register("x", () => valid)).toBeUndefined();
    expect(reg.get("sample-plugin")?.collections).toEqual([]);
  });

  it("rejects unknown fields (strict contract)", () => {
    const reg = new PluginRegistry("0.1.0");
    const issue = reg.register("x", () => ({ ...valid, runAsAdmin: true }));
    expect(issue?.reason).toMatch(/Unrecognized key/);
  });

  it("rejects prompt-template capability without a template", () => {
    const reg = new PluginRegistry("0.1.0");
    const issue = reg.register("x", () => ({ ...valid, capabilities: ["prompt-template"] }));
    expect(issue?.reason).toMatch(/promptTemplate/);
  });

  it("rejects plugins built for an incompatible host", () => {
    const reg = new PluginRegistry("1.2.0");
    expect(reg.register("x", () => valid)?.reason).toMatch(/not in range/);
  });

  it("rejects duplicate ids and unreadable manifests", () => {
    const reg = new PluginRegistry("0.1.0");
    reg.register("a", () => valid);
    expect(reg.register("b", () => valid)?.reason).toMatch(/duplicate/);
    expect(
      reg.register("c", () => {
        throw new Error("bad json");
      })?.reason,
    ).toMatch(/unreadable/);
  });
});
