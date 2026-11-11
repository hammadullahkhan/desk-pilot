import { contextBridge, ipcRenderer } from "electron";
import { Channels, CONTRACT_VERSION } from "../shared/channels";
import type { AssistantApi } from "../shared/contracts";

// Sandboxed preloads cannot require local files, so this is bundled with esbuild (see package.json).
// The only surface the renderer can reach. No raw ipcRenderer, no Node APIs.
const api: AssistantApi = {
  contractVersion: CONTRACT_VERSION,
  sendChat: (req) => ipcRenderer.invoke(Channels.CHAT_SEND, req),
  listPlugins: () => ipcRenderer.invoke(Channels.PLUGINS_LIST),
  sidecarStatus: () => ipcRenderer.invoke(Channels.SIDECAR_STATUS),
};

contextBridge.exposeInMainWorld("assistant", api);
