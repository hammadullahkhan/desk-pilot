// End-to-end smoke test: launches the real Electron app (which spawns the Python sidecar),
// asks a plugin-scoped question through the UI, and checks the grounded answer.
// Usage: npm run build && node e2e/smoke.mjs   (set DESK_PILOT_PYTHON to the sidecar venv's python)
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";

// Chromium refuses its sandbox as root (e.g. CI containers); only then disable it.
const args = process.getuid?.() === 0 ? ["--no-sandbox", "."] : ["."];
const app = await electron.launch({ args, env: { ...process.env }, timeout: 60000 });
try {
  const win = await app.firstWindow();
  // Locator waits (not waitForFunction): the page CSP forbids string eval, which is the point.
  await win.locator("#status", { hasText: "sidecar ready" }).waitFor({ timeout: 45000 });
  await win.selectOption("#plugin", "meeting-notes");
  await win.fill("#input", "Who is writing the ADR for the IPC contract?");
  await win.click("button[type=submit]");
  const answer = win.locator(".msg.assistant").first();
  await answer.waitFor({ timeout: 30000 });
  const text = await answer.textContent();
  assert.match(text ?? "", /Priya/);
  assert.match(text ?? "", /route: retrieve/);
  // Renderer must not see Node.
  assert.equal(await win.evaluate(() => typeof (globalThis).require), "undefined");
  console.log("E2E OK:", text);
} finally {
  await app.close();
}
