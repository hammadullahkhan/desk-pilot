"""LangGraph agent: route -> (retrieve) -> generate.

route decides whether the question needs grounding in local documents. retrieve
pulls chunks from the vector store, scoped to the active plugin's collections.
generate calls the model with the retrieved context and the plugin's prompt template.
"""
from __future__ import annotations

from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from .rag import Hit, VectorStore

SMALL_TALK = {"hi", "hello", "hey", "thanks", "thank you"}
BASE_PROMPT = "You are a concise desktop assistant. Answer only from the context when context is provided."


class AgentState(TypedDict, total=False):
    message: str
    collections: list[str]
    prompt_template: str | None
    route: Literal["retrieve", "direct"]
    hits: list[Hit]
    answer: str


def build_graph(store: VectorStore, llm):
    def route(state: AgentState) -> AgentState:
        text = state["message"].strip().lower().rstrip("!.")
        needs_docs = bool(state.get("collections")) or (text not in SMALL_TALK and bool(store.search(text, k=1)))
        return {"route": "retrieve" if needs_docs else "direct"}

    def retrieve(state: AgentState) -> AgentState:
        return {"hits": store.search(state["message"], k=3, collections=state.get("collections") or [])}

    def generate(state: AgentState) -> AgentState:
        system = BASE_PROMPT
        if state.get("prompt_template"):
            system += "\n" + state["prompt_template"]
        hits = state.get("hits") or []
        if hits:
            system += "\n\nContext:\n" + "\n\n".join(h.text for h in hits)
        reply = llm.invoke([SystemMessage(content=system), HumanMessage(content=state["message"])])
        return {"answer": str(reply.content)}

    g = StateGraph(AgentState)
    g.add_node("route", route)
    g.add_node("retrieve", retrieve)
    g.add_node("generate", generate)
    g.add_edge(START, "route")
    g.add_conditional_edges("route", lambda s: s["route"], {"retrieve": "retrieve", "direct": "generate"})
    g.add_edge("retrieve", "generate")
    g.add_edge("generate", END)
    return g.compile()
