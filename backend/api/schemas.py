from typing import List, Literal, Optional

from pydantic import BaseModel


class Citation(BaseModel):
    """One retrieved source backing an answer. `kind` is "table" (from
    search_filing_tables -- has page + bbox) or "narrative" (from
    search_child_chunks / retrieve_parent_chunks -- has parent_id and
    page_start/page_end instead of page + bbox)."""

    kind: str
    source: str
    page: Optional[float] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    parent_id: Optional[str] = None
    caption: Optional[str] = None
    bbox_x: Optional[float] = None
    bbox_y: Optional[float] = None
    bbox_w: Optional[float] = None
    bbox_h: Optional[float] = None


class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None  # omit on the first message; the response returns one to reuse


class ChatResponse(BaseModel):
    thread_id: str
    answer: str
    sources: List[str] = []
    citations: List[Citation] = []
    needs_clarification: bool = False  # True -> `answer` is a clarifying question, not a final answer


class DocumentOut(BaseModel):
    name: str


class UploadJobResponse(BaseModel):
    """Returned immediately on POST /documents -- ingestion runs in the
    background, poll GET /documents/jobs/{job_id} for progress."""

    job_id: str
    status: Literal["pending"] = "pending"


class JobStatus(BaseModel):
    job_id: str
    status: Literal["pending", "running", "done", "error"]
    added: int = 0
    skipped: int = 0
    documents: List[str] = []  # full current document list -- only meaningful once status == "done"
    error: Optional[str] = None  # set only when status == "error"


class ClearResponse(BaseModel):
    cleared: bool = True


class DeleteResponse(BaseModel):
    deleted: str  # the document name that was removed
    child_chunks: int  # Qdrant points removed
    parent_chunks: int
    tables: int


class LLMConfigRequest(BaseModel):
    provider: Literal["ollama", "gemini"]
    model: str
    api_key: Optional[str] = None  # only meaningful for "gemini"; never echoed back or persisted to disk


class LLMConfigStatus(BaseModel):
    provider: Literal["ollama", "gemini"]
    model: str
    has_api_key: bool  # whether a Gemini key is set right now -- never the key itself
