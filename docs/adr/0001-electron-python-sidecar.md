# 0001. Run AI work in a Python sidecar, not in the Electron main process

Status: Accepted

## Context
The assistant needs an agent framework, retrieval and model SDKs. The mature tooling for this (LangGraph, LangChain, numpy, embedding libraries) is in Python. The desktop shell and UI are best served by Electron and TypeScript.

## Decision
The Electron main process spawns a local Python process (`desk_sidecar`) and talks to it over HTTP on 127.0.0.1. Main owns the sidecar's lifecycle: start on ready, health checks, stop on `will-quit`.

## Consequences
- Each side uses its natural ecosystem, and the sidecar can be tested on its own with pytest.
- An extra process to package and supervise. The renderer polls health so startup latency is visible instead of failing silently.
- The HTTP boundary is a contract. Main validates every sidecar response with the same zod schemas the UI relies on.
