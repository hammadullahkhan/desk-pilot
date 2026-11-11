from pathlib import Path

from fastapi.testclient import TestClient

from desk_sidecar.llm import ExtractiveFallback
from desk_sidecar.server import create_app

DOCS = Path(__file__).resolve().parent.parent / "sample_docs"


def client():
    return TestClient(create_app(DOCS, llm=ExtractiveFallback()))


def test_health_reports_ingested_chunks():
    body = client().get("/health").json()
    assert body["healthy"] is True and body["documents"] > 0 and body["model"] == "extractive-fallback"


def test_plugin_scoped_question_is_grounded_in_its_collection():
    res = client().post(
        "/chat",
        json={"message": "Who owns the ADR for the IPC contract?", "collections": ["meeting-notes"]},
    ).json()
    assert res["route"] == "retrieve"
    assert all(s["docId"].startswith("2026-11-03-sprint-review") for s in res["sources"])
    assert "Priya" in res["answer"]


def test_small_talk_skips_retrieval():
    res = client().post("/chat", json={"message": "hello"}).json()
    assert res["route"] == "direct" and res["sources"] == []


def test_ingest_then_retrieve():
    c = client()
    c.post("/ingest", json={"doc_id": "faq", "collection": "faq", "text": "Desk Pilot stores no data in the cloud."})
    res = c.post("/chat", json={"message": "Does Desk Pilot store data in the cloud?", "collections": ["faq"]}).json()
    assert res["sources"][0]["docId"] == "faq#0"


def test_rejects_empty_message():
    assert client().post("/chat", json={"message": ""}).status_code == 422
