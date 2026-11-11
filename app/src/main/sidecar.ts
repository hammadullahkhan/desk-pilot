import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { ChatResponse, ChatResponseSchema, SidecarStatus, SidecarStatusSchema } from "../shared/contracts";

export interface SidecarRequest {
  message: string;
  collections: string[];
  promptTemplate?: string;
}

/**
 * Owns the lifecycle of the local Python sidecar and the HTTP boundary to it.
 * Responses are validated with the same zod schemas the renderer relies on,
 * so a misbehaving sidecar cannot push malformed data into the UI.
 */
export class SidecarClient {
  private proc?: ChildProcess;

  constructor(private readonly baseUrl: string, private readonly fetchImpl: typeof fetch = fetch) {}

  start(sidecarDir: string, port: number, python = process.env.DESK_PILOT_PYTHON ?? "python"): void {
    this.proc = spawn(python, ["-m", "desk_sidecar.server", "--port", String(port)], {
      cwd: sidecarDir,
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, PYTHONPATH: join(sidecarDir) },
    });
  }

  stop(): void {
    this.proc?.kill();
    this.proc = undefined;
  }

  async status(): Promise<SidecarStatus> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/health`);
      if (!res.ok) return { healthy: false };
      return SidecarStatusSchema.parse(await res.json());
    } catch {
      return { healthy: false };
    }
  }

  async chat(req: SidecarRequest): Promise<ChatResponse> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: req.message,
        collections: req.collections,
        prompt_template: req.promptTemplate,
      }),
    });
    if (!res.ok) throw new Error(`sidecar returned ${res.status}`);
    return ChatResponseSchema.parse(await res.json());
  }
}
