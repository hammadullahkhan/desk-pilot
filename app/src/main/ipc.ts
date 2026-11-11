import { Channels, ChatRequestSchema, ChatResponse } from "../shared/contracts";
import type { PluginRegistry } from "./plugins/registry";
import type { SidecarClient } from "./sidecar";

type Handler = (payload: unknown) => Promise<unknown>;

/**
 * Builds the IPC handler table. Kept free of Electron imports so it can be unit tested;
 * main.ts wires these handlers into ipcMain.handle.
 */
export function buildHandlers(registry: PluginRegistry, sidecar: SidecarClient): Record<string, Handler> {
  return {
    [Channels.CHAT_SEND]: async (payload): Promise<ChatResponse> => {
      const req = ChatRequestSchema.parse(payload);
      const plugin = req.pluginId ? registry.get(req.pluginId) : undefined;
      if (req.pluginId && !plugin) throw new Error(`unknown plugin ${req.pluginId}`);
      return sidecar.chat({
        message: req.message,
        collections: plugin?.collections ?? [],
        promptTemplate: plugin?.promptTemplate,
      });
    },
    [Channels.PLUGINS_LIST]: async () => registry.summaries(),
    [Channels.SIDECAR_STATUS]: async () => sidecar.status(),
  };
}
