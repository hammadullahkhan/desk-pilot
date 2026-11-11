# Desk Pilot

A desktop AI assistant built with **Electron + TypeScript** and a local **Python sidecar** running a **LangGraph** agent with retrieval-augmented generation (RAG). Capabilities are added through **versioned plugin manifests** validated at startup.

```
┌──────────── Electron ─────────────┐        HTTP (127.0.0.1)       ┌────────── Python sidecar ──────────┐
│ renderer (sandboxed, CSP)          │                              │ FastAPI                              │
│   │ window.assistant (typed API)   │                              │   └─ LangGraph: route → retrieve →  │
│ preload (contextBridge, bundled)   │                              │                 generate             │
│   │ ipcRenderer.invoke             │                              │ VectorStore (pluggable embedder)     │
│ main                               │ ── zod-validated requests ─▶ │ Claude via langchain-anthropic, or   │
│   ├─ PluginRegistry (manifests)    │ ◀─ zod-validated responses ─ │ offline extractive fallback          │
│   └─ SidecarClient (lifecycle)     │                              │                                      │
└────────────────────────────────────┘                              └──────────────────────────────────────┘
```

## Why it is shaped this way

- **Process boundaries are contracts.** `app/src/shared/contracts.ts` is the single source of truth for IPC channels and payloads. Both directions are validated with zod, so neither an untrusted renderer nor a misbehaving sidecar can push malformed data across. See [ADR 0003](docs/adr/0003-ipc-boundary.md).
- **The renderer gets nothing it doesn't need.** `contextIsolation`, `sandbox`, no `nodeIntegration`, a strict CSP, and a three-method API exposed through the preload.
- **Python owns the AI work.** The agent, retrieval and model calls live in a sidecar so the Python AI ecosystem can be used directly. See [ADR 0001](docs/adr/0001-electron-python-sidecar.md).
- **Plugins extend without code changes to the host.** A plugin is a folder with a `manifest.json` (id, semver version, supported host range, capabilities, collections, optional prompt template). Invalid, duplicate or incompatible plugins are skipped and logged, never fatal. See [ADR 0002](docs/adr/0002-plugin-manifest-contract.md).
- **Architecture is enforced in CI, not just documented.** `app/test/architecture.test.ts` fails the build if a layer imports across a forbidden boundary (for example renderer → main, or a runtime import into the renderer).

## Run it

Requirements: Node 20+, Python 3.10+.

```bash
# Python sidecar
cd sidecar
python -m venv .venv
.venv/bin/pip install -e ".[dev,anthropic]"      # Windows: .venv\Scripts\pip
.venv/bin/python -m pytest

# Electron app
cd ../app
npm install
npm run check                                     # typecheck + unit + architecture tests
DESK_PILOT_PYTHON=../sidecar/.venv/bin/python npm start
```

Set `ANTHROPIC_API_KEY` to answer with Claude (model configurable with `DESK_PILOT_MODEL`). Without a key, the sidecar uses a deterministic extractive fallback so the app, tests and CI run offline.

End-to-end test (launches the real app and sidecar through Playwright's Electron driver):

```bash
cd app && DESK_PILOT_PYTHON=../sidecar/.venv/bin/python npm run e2e
```

## Adding a plugin

Create `app/plugins/<id>/manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "meeting-notes",
  "name": "Meeting Notes Summarizer",
  "version": "0.2.0",
  "hostRange": ">=0.1.0 <1.0.0",
  "capabilities": ["retrieval", "prompt-template"],
  "promptTemplate": "Summarize the relevant notes as action items with owners.",
  "collections": ["meeting-notes"]
}
```

and put its documents in `sidecar/sample_docs/<collection>/`. Questions asked with that plugin selected only search its collections.

## Layout

```
app/
  src/shared/      contracts.ts, channels.ts, manifest.ts   (no Electron, no Node)
  src/main/        main.ts, ipc.ts, sidecar.ts, plugins/registry.ts
  src/preload/     preload.ts                               (esbuild-bundled for the sandbox)
  src/renderer/    index.html, renderer.ts, styles.css
  test/            registry, ipc, architecture tests (vitest)
  e2e/             smoke.mjs (Playwright + Electron)
sidecar/
  desk_sidecar/    server.py, graph.py, rag.py, llm.py
  tests/           pytest
docs/adr/          architecture decision records
```

## Roadmap

- Stream tokens from the sidecar to the renderer (needs contract v2, see ADR 0003)
- Swap the hashing embedder for a hosted embedding model and a persistent vector store
- Tool-calling plugins (the `tool` capability is reserved in the manifest schema)
- Package with electron-builder and bundle the sidecar with PyInstaller
