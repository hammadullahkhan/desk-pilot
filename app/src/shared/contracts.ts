/**
 * IPC contract between the renderer (untrusted UI) and the main process.
 * This file is the single source of truth for channel names and payload shapes.
 * Changing a payload shape is a breaking change: bump CONTRACT_VERSION and add an ADR.
 */
import { z } from "zod";

export { CONTRACT_VERSION, Channels } from "./channels";
export type { Channel } from "./channels";

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  pluginId: z.string().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  answer: z.string(),
  route: z.enum(["retrieve", "direct"]),
  sources: z.array(z.object({ docId: z.string(), score: z.number() })),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const SidecarStatusSchema = z.object({
  healthy: z.boolean(),
  model: z.string().optional(),
  documents: z.number().int().nonnegative().optional(),
});
export type SidecarStatus = z.infer<typeof SidecarStatusSchema>;

export interface PluginSummary {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
}

/** Shape exposed to the renderer through the preload bridge. */
export interface AssistantApi {
  contractVersion: number;
  sendChat(req: ChatRequest): Promise<ChatResponse>;
  listPlugins(): Promise<PluginSummary[]>;
  sidecarStatus(): Promise<SidecarStatus>;
}
