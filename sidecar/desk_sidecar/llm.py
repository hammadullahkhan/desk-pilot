"""Model selection. Uses Claude via langchain-anthropic when an API key is present,
otherwise a deterministic extractive fallback so the app and tests run offline."""
from __future__ import annotations

import os
import re

from langchain_core.messages import AIMessage, BaseMessage


class ExtractiveFallback:
    """Answers with the context sentences that best overlap the question."""

    model_name = "extractive-fallback"

    def invoke(self, messages: list[BaseMessage]) -> AIMessage:
        system = "\n".join(str(m.content) for m in messages if m.type == "system")
        question = str(messages[-1].content)
        context = system.split("Context:", 1)[1] if "Context:" in system else ""
        q_words = set(re.findall(r"[a-z0-9]+", question.lower()))
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", context) if len(s.strip()) > 20]
        ranked = sorted(sentences, key=lambda s: -len(q_words & set(re.findall(r"[a-z0-9]+", s.lower()))))
        if not ranked:
            return AIMessage(content="I don't have documents on that yet. Try a plugin with a matching collection.")
        return AIMessage(content=" ".join(ranked[:2]))


def get_llm():
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            from langchain_anthropic import ChatAnthropic

            llm = ChatAnthropic(model=os.environ.get("DESK_PILOT_MODEL", "claude-sonnet-4-5"), max_tokens=800)
            llm.model_name = llm.model  # uniform attribute for /health
            return llm
        except ImportError:
            pass
    return ExtractiveFallback()
