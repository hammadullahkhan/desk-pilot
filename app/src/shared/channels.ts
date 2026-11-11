/** Dependency-free IPC constants, safe to bundle into the sandboxed preload. */
export const CONTRACT_VERSION = 1;

export const Channels = {
  CHAT_SEND: "assistant:chat:send",
  PLUGINS_LIST: "assistant:plugins:list",
  SIDECAR_STATUS: "assistant:sidecar:status",
} as const;

export type Channel = (typeof Channels)[keyof typeof Channels];
