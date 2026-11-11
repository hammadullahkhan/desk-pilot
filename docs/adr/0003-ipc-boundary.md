# 0003. Typed, validated IPC and enforced layer boundaries

Status: Accepted

## Context
The renderer displays model output and must be treated as untrusted. Without discipline, Electron apps drift toward renderers that reach Node APIs and modules that import across process boundaries.

## Decision
- Renderer: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP (no inline script, no eval).
- The preload exposes exactly the `AssistantApi` interface. Channel names live in the dependency-free `shared/channels.ts` so the preload bundle stays tiny.
- Main validates renderer payloads (`ChatRequestSchema`) before doing any work.
- Allowed imports: `main → shared`, `preload → shared`, `renderer → shared (types only)`, `shared → (zod only)`. `test/architecture.test.ts` enforces this in CI.
- `CONTRACT_VERSION` is exposed to the renderer. Changing a payload shape bumps it.

## Consequences
- Dependency direction is protected automatically; a violating import fails the build with the offending path.
- Streaming responses will need contract v2 (a new channel for token events), recorded in a follow-up ADR.
