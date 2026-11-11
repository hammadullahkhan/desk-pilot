from desk_sidecar.rag import HashingEmbedder, VectorStore, chunk


def test_chunk_packs_paragraphs():
    text = "a" * 400 + "\n\n" + "b" * 400 + "\n\n" + "c" * 10
    assert [len(c) for c in chunk(text, max_chars=600)] == [400, 412]


def test_embeddings_are_normalised_and_stable():
    e = HashingEmbedder(dim=64)
    v1, v2 = e.embed(["plugin manifest validation"]), e.embed(["plugin manifest validation"])
    assert abs(float((v1 * v1).sum()) - 1.0) < 1e-5
    assert (v1 == v2).all()


def test_search_ranks_relevant_chunk_and_scopes_collections():
    s = VectorStore()
    s.add_document("plugins", "Plugins declare a manifest with a host version range.", "docs")
    s.add_document("lunch", "The cafeteria serves soup on Fridays.", "notes")
    hits = s.search("what goes in a plugin manifest?", collections=["docs"])
    assert hits and hits[0].doc_id == "plugins#0"
    assert s.search("plugin manifest", collections=["notes"]) == []
