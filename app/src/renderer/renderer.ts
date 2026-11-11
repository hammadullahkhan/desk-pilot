// Plain browser script (no module loader in a sandboxed renderer). Types come from global.d.ts.
type PluginSummary = Awaited<ReturnType<Window["assistant"]["listPlugins"]>>[number];

const log = document.getElementById("log") as HTMLDivElement;
const form = document.getElementById("form") as HTMLFormElement;
const input = document.getElementById("input") as HTMLInputElement;
const pluginSelect = document.getElementById("plugin") as HTMLSelectElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;

function append(role: "you" | "assistant", text: string, meta?: string): void {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  if (meta) {
    const m = document.createElement("small");
    m.textContent = meta;
    el.appendChild(m);
  }
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

async function waitForSidecar(attempts = 30): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const s = await window.assistant.sidecarStatus();
    if (s.healthy) {
      statusEl.textContent = `sidecar ready · ${s.model} · ${s.documents} chunks`;
      return;
    }
    statusEl.textContent = "starting sidecar…";
    await new Promise((r) => setTimeout(r, 1000));
  }
  statusEl.textContent = "sidecar offline";
}

async function init(): Promise<void> {
  void waitForSidecar();
  const plugins: PluginSummary[] = await window.assistant.listPlugins();
  for (const p of plugins) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.version})`;
    pluginSelect.appendChild(opt);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  append("you", message);
  try {
    const res = await window.assistant.sendChat({ message, pluginId: pluginSelect.value || undefined });
    const meta = res.sources.length ? `route: ${res.route} · sources: ${res.sources.map((s) => s.docId).join(", ")}` : `route: ${res.route}`;
    append("assistant", res.answer, meta);
  } catch (err) {
    append("assistant", `Error: ${(err as Error).message}`);
  }
});

void init();
