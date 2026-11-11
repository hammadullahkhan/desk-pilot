# 0002. Plugins are declared by a strict, versioned manifest

Status: Accepted

## Context
New assistant capabilities (document sets, prompt styles, later tools) should be addable without changing host code, and a broken plugin must not take the app down.

## Decision
Each plugin folder contains `manifest.json`, validated by `PluginManifestSchema`:
- `schemaVersion` is a literal; a new manifest shape means a new schema version.
- The schema is `.strict()`: unknown keys are rejected rather than silently ignored.
- `version` is semver and `hostRange` is a semver range checked against the running app version.
- Cross-field rules live in the schema (a `prompt-template` capability requires `promptTemplate`).

`PluginRegistry` loads every manifest, collects problems as `RegistryIssue`s, and registers only valid, compatible, unique plugins.

## Consequences
- Plugin authors get precise validation errors; the host never crashes on a bad plugin.
- Breaking the manifest shape requires bumping `MANIFEST_SCHEMA_VERSION` and supporting both versions during a migration window.
