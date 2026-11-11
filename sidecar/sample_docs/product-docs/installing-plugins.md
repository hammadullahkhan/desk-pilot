# Installing plugins

Plugins live in the plugins folder next to the app. Each plugin has a manifest.json that declares its id, version, supported host range and capabilities.

The host validates every manifest at startup. Plugins with unknown fields, invalid versions, or a host range that does not include the running app version are skipped and logged instead of crashing the app.

# Collections

A retrieval plugin lists the document collections it can search. Each collection is a folder of Markdown files under sample_docs. Questions sent with that plugin only search its collections.
