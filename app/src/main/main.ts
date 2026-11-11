import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { PluginRegistry } from "./plugins/registry";
import { SidecarClient } from "./sidecar";
import { buildHandlers } from "./ipc";

const SIDECAR_PORT = Number(process.env.DESK_PILOT_SIDECAR_PORT ?? 8765);

const registry = new PluginRegistry(app.getVersion());
const sidecar = new SidecarClient(`http://127.0.0.1:${SIDECAR_PORT}`);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  const { issues } = registry.load(join(app.getAppPath(), "plugins"));
  issues.forEach((i) => console.warn(`[plugins] skipped ${i.folder}: ${i.reason}`));

  sidecar.start(join(app.getAppPath(), "..", "sidecar"), SIDECAR_PORT);

  for (const [channel, handler] of Object.entries(buildHandlers(registry, sidecar))) {
    ipcMain.handle(channel, (_event, payload) => handler(payload));
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Never leave an orphaned Python process behind.
app.on("will-quit", () => sidecar.stop());
