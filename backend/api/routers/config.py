import os

from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_rag_system
from api.schemas import LLMConfigRequest, LLMConfigStatus
from core.rag_system import RAGSystem

router = APIRouter(prefix="/config", tags=["config"])

# In-memory only, single global RAGSystem -- matches the rest of this backend's
# single-instance assumption. Switching providers rebuilds the agent graph,
# which drops any in-progress conversation (see RAGSystem.reconfigure_llm).


@router.get("/llm", response_model=LLMConfigStatus)
def get_llm_config(rag_system: RAGSystem = Depends(get_rag_system)):
    return LLMConfigStatus(
        provider=rag_system.llm_provider,
        model=rag_system.llm_model,
        has_api_key=bool(os.environ.get("GOOGLE_API_KEY")),
    )


@router.post("/llm", response_model=LLMConfigStatus)
def set_llm_config(request: LLMConfigRequest, rag_system: RAGSystem = Depends(get_rag_system)):
    if request.provider == "gemini" and not request.api_key and not os.environ.get("GOOGLE_API_KEY"):
        raise HTTPException(
            status_code=400,
            detail="Gemini requires an API key -- none was provided and none is currently set.",
        )

    try:
        rag_system.reconfigure_llm(request.provider, request.model, api_key=request.api_key)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not switch LLM: {exc}") from exc

    return LLMConfigStatus(
        provider=rag_system.llm_provider,
        model=rag_system.llm_model,
        has_api_key=bool(os.environ.get("GOOGLE_API_KEY")),
    )
