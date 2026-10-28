import uuid

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import AIMessage, HumanMessage

from api.deps import get_rag_system
from api.schemas import ChatRequest, ChatResponse, Citation
from core.rag_system import RAGSystem

router = APIRouter(prefix="/chat", tags=["chat"])


def _last_ai_message(messages):
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            return msg
    return None


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest, rag_system: RAGSystem = Depends(get_rag_system)):
    thread_id = request.thread_id or str(uuid.uuid4())
    graph_config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": rag_system.recursion_limit,
    }

    current_state = rag_system.agent_graph.get_state(graph_config)

    if current_state.next:
        # a prior turn is paused at request_clarification -- this message answers it
        rag_system.agent_graph.update_state(
            graph_config, {"messages": [HumanMessage(content=request.message.strip())]}
        )
        rag_system.agent_graph.invoke(None, config=graph_config)
    else:
        rag_system.agent_graph.invoke(
            {"messages": [HumanMessage(content=request.message.strip())]}, config=graph_config
        )

    final_state = rag_system.agent_graph.get_state(graph_config)
    last_ai = _last_ai_message(final_state.values.get("messages", []))

    if last_ai is None:
        raise HTTPException(status_code=500, detail="No response generated.")

    if final_state.next:
        # graph paused again -- `answer` here is the clarifying question, not a final answer
        return ChatResponse(thread_id=thread_id, answer=last_ai.content, needs_clarification=True)

    # aggregate_answers() already normalizes content to str and reconciles citations
    # against the LLM's own self-reported Sources: list -- nothing left to parse here.
    citations_raw = (last_ai.additional_kwargs or {}).get("citations", [])
    citations = [Citation(**c) for c in citations_raw]
    sources = sorted({c.source for c in citations})

    return ChatResponse(
        thread_id=thread_id,
        answer=last_ai.content,
        sources=sources,
        citations=citations,
    )
