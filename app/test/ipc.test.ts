import { describe, it, expect, vi } from "vitest";
import { Channels } from "../src/shared/contracts";
import { buildHandlers } from "../src/main/ipc";
import { PluginRegistry } from "../src/main/plugins/registry";
import { SidecarClient } from "../src/main/sidecar";

function setup(response: unknown, ok = true) {
  const fetchImpl = vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => response }) as Response);
  const registry = new PluginRegistry("0.1.0");
  registry.register("notes", () => ({
    schemaVersion: 1,
    id: "meeting-notes",
    name: "Notes",
    version: "0.2.0",
    hostRange: ">=0.1.0",
    capabilities: ["retrieval", "prompt-template"],
    promptTemplate: "Summarize as action items.",
    collections: ["meeting-notes"],
  }));
  const handlers = buildHandlers(registry, new SidecarClient("http://sidecar", fetchImpl as unknown as typeof fetch));
  return { handlers, fetchImpl };
}

describe("IPC handlers", () => {
  it("forwards plugin collections and template to the sidecar", async () => {
    const { handlers, fetchImpl } = setup({ answer: "ok", route: "retrieve", sources: [{ docId: "n1", score: 0.9 }] });
    const res = await handlers[Channels.CHAT_SEND]({ message: "what did we decide?", pluginId: "meeting-notes" });
    expect(res).toMatchObject({ answer: "ok", route: "retrieve" });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ message: "what did we decide?", collections: ["meeting-notes"], prompt_template: "Summarize as action items." });
  });

  it("rejects invalid renderer payloads before reaching the sidecar", async () => {
    const { handlers, fetchImpl } = setup({});
    await expect(handlers[Channels.CHAT_SEND]({ message: "   " })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects unknown plugins", async () => {
    const { handlers } = setup({});
    await expect(handlers[Channels.CHAT_SEND]({ message: "hi", pluginId: "nope" })).rejects.toThrow(/unknown plugin/);
  });

  it("refuses malformed sidecar responses", async () => {
    const { handlers } = setup({ answer: 42 });
    await expect(handlers[Channels.CHAT_SEND]({ message: "hi" })).rejects.toThrow();
  });

  it("reports an unhealthy sidecar instead of throwing", async () => {
    const { handlers } = setup({}, false);
    await expect(handlers[Channels.SIDECAR_STATUS](undefined)).resolves.toEqual({ healthy: false });
  });
});
