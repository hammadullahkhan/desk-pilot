"""Retrieval layer: chunking, embeddings and an in-memory vector store.

The embedder is behind a small protocol so the local hashing embedder (no network,
deterministic, good for tests) can be swapped for a hosted embedding model.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol, Sequence

import numpy as np

TOKEN_RE = re.compile(r"[a-z0-9]+")


class Embedder(Protocol):
    dim: int

    def embed(self, texts: Sequence[str]) -> np.ndarray: ...


class HashingEmbedder:
    """Feature-hashed bag of words + bigrams, L2-normalised."""

    def __init__(self, dim: int = 1024) -> None:
        self.dim = dim

    def embed(self, texts: Sequence[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            tokens = TOKEN_RE.findall(text.lower())
            features = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]
            for f in features:
                out[row, hash_token(f) % self.dim] += 1.0
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        return out / np.where(norms == 0, 1, norms)


def hash_token(token: str) -> int:
    # Stable across processes (Python's hash() is salted per process).
    h = 2166136261
    for ch in token.encode():
        h = ((h ^ ch) * 16777619) & 0xFFFFFFFF
    return h


def chunk(text: str, max_chars: int = 600) -> list[str]:
    """Split on blank lines, then pack paragraphs up to max_chars."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for p in paras:
        if current and len(current) + len(p) + 2 > max_chars:
            chunks.append(current)
            current = p
        else:
            current = f"{current}\n\n{p}" if current else p
    if current:
        chunks.append(current)
    return chunks


@dataclass(frozen=True)
class Hit:
    doc_id: str
    collection: str
    text: str
    score: float


class VectorStore:
    def __init__(self, embedder: Embedder | None = None) -> None:
        self.embedder = embedder or HashingEmbedder()
        self._vectors = np.zeros((0, self.embedder.dim), dtype=np.float32)
        self._meta: list[tuple[str, str, str]] = []  # (doc_id, collection, text)

    def __len__(self) -> int:
        return len(self._meta)

    def add_document(self, doc_id: str, text: str, collection: str) -> int:
        pieces = chunk(text)
        if not pieces:
            return 0
        self._vectors = np.vstack([self._vectors, self.embedder.embed(pieces)])
        self._meta.extend((f"{doc_id}#{i}", collection, p) for i, p in enumerate(pieces))
        return len(pieces)

    def search(self, query: str, k: int = 3, collections: Sequence[str] = (), min_score: float = 0.1) -> list[Hit]:
        if not self._meta:
            return []
        scores = self._vectors @ self.embedder.embed([query])[0]
        hits = [
            Hit(doc_id, coll, text, float(scores[i]))
            for i, (doc_id, coll, text) in enumerate(self._meta)
            if (not collections or coll in collections) and scores[i] >= min_score
        ]
        return sorted(hits, key=lambda h: h.score, reverse=True)[:k]
