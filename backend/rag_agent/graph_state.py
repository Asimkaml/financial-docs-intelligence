from typing import List, Annotated, Set
from langgraph.graph import MessagesState
import operator

def accumulate_or_reset(existing: List[dict], new: List[dict]) -> List[dict]:
    if new and any(item.get('__reset__') for item in new):
        return []
    return existing + new

def set_union(a: Set[str], b: Set[str]) -> Set[str]:
    return a | b

def append_unique(existing: List[str], new: List[str]) -> List[str]:
    return list(dict.fromkeys(existing + new))

def _citation_key(c: dict):
    return (c.get("kind"), c.get("source"), c.get("parent_id"), c.get("page"),
            c.get("page_start"), c.get("page_end"))

def accumulate_citations(existing: List[dict], new: List[dict]) -> List[dict]:
    """Citations must survive compress_context's message pruning, so this
    accumulates across the whole sub-question's lifetime rather than being
    recomputed from current messages each time (unlike retrieved_contexts,
    which recomputes from state["messages"] and loses anything already
    compressed away)."""
    seen = {_citation_key(c) for c in existing}
    merged = list(existing)
    for c in new:
        key = _citation_key(c)
        if key not in seen:
            seen.add(key)
            merged.append(c)
    return merged

class State(MessagesState):
    """State for main agent graph"""
    questionIsClear: bool = False
    conversation_summary: str = ""
    originalQuery: str = ""
    pendingQuery: str = ""
    pendingClarifications: List[str] = []
    rewrittenQuestions: List[str] = []
    agent_answers: Annotated[List[dict], accumulate_or_reset] = []

class AgentState(MessagesState):
    """State for individual agent subgraph"""
    question: str = ""
    question_index: int = 0
    context_summary: str = ""
    retrieval_keys: Annotated[Set[str], set_union] = set()
    retrieved_contexts: Annotated[List[str], append_unique] = []
    citations: Annotated[List[dict], accumulate_citations] = []
    final_answer: str = ""
    agent_answers: List[dict] = []
    tool_call_count: Annotated[int, operator.add] = 0
    iteration_count: Annotated[int, operator.add] = 0