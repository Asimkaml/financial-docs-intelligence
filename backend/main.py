from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import chat, citations, config, documents
from core.document_manager import DocumentManager
from core.rag_system import RAGSystem


@asynccontextmanager
async def lifespan(app: FastAPI):
    rag_system = RAGSystem()
    rag_system.initialize()
    app.state.rag_system = rag_system
    app.state.document_manager = DocumentManager(rag_system)
    app.state.ingestion_jobs = {}  # job_id -> status dict, see api/routers/documents.py
    yield
    # no explicit teardown yet -- Qdrant/DuckDB connections close with process exit


app = FastAPI(title="Financial RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # adjust to your React dev server's actual origin
    allow_methods=["*"],
    allow_headers=["*"],
    # Without this, the browser receives these headers but JS can't read them via fetch() --
    # citations.py's page-image endpoint relies on the frontend reading them to scale bboxes.
    expose_headers=["X-Page-Width", "X-Page-Height", "X-Rendered-Width", "X-Rendered-Height"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(citations.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
