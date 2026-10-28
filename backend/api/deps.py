"""FastAPI dependency accessors.

Both RAGSystem and DocumentManager are built once in main.py's lifespan
hook and stashed on app.state -- these just hand them to route handlers
via Depends(), so routers don't reach into `request.app.state` directly
and stay easy to test with a fake state.
"""

from fastapi import Request

from core.document_manager import DocumentManager
from core.rag_system import RAGSystem


def get_rag_system(request: Request) -> RAGSystem:
    return request.app.state.rag_system


def get_document_manager(request: Request) -> DocumentManager:
    return request.app.state.document_manager
