"""HTTP boundary to the Electron main process (localhost only)."""
from __future__ import annotations

import argparse
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .graph import build_graph
from .llm import get_llm
from .rag import VectorStore

DEFAULT_DOCS = Path(__file__).resolve().parent.parent / "sample_docs"


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    collections: list[str] = []
    prompt_template: str | None = None


class IngestIn(BaseModel):
    doc_id: str
    collection: str
    text: str = Field(min_length=1)


def ingest_folder(store: VectorStore, root: Path) -> None:
    """Each subfolder of root is a collection; each .md/.txt file is a document."""
    if not root.exists():
        return
    for coll in sorted(p for p in root.iterdir() if p.is_dir()):
        for f in sorted(coll.glob("*.md")) + sorted(coll.glob("*.txt")):
            store.add_document(f.stem, f.read_text(encoding="utf-8"), coll.name)


def create_app(docs_root: Path = DEFAULT_DOCS, llm=None) -> FastAPI:
    store = VectorStore()
    ingest_folder(store, docs_root)
    llm = llm or get_llm()
    graph = build_graph(store, llm)
    app = FastAPI(title="desk-sidecar")

    @app.get("/health")
    def health():
        return {"healthy": True, "model": getattr(llm, "model_name", "unknown"), "documents": len(store)}

    @app.post("/chat")
    def chat(req: ChatIn):
        try:
            out = graph.invoke(
                {"message": req.message, "collections": req.collections, "prompt_template": req.prompt_template}
            )
        except Exception as exc:  # surface model/provider failures as 502, not a crash
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return {
            "answer": out["answer"],
            "route": out["route"],
            "sources": [{"docId": h.doc_id, "score": round(h.score, 3)} for h in out.get("hits", [])],
        }

    @app.post("/ingest")
    def ingest(req: IngestIn):
        return {"chunks": store.add_document(req.doc_id, req.text, req.collection)}

    return app


def main() -> None:
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--docs", type=Path, default=DEFAULT_DOCS)
    args = parser.parse_args()
    uvicorn.run(create_app(args.docs), host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
