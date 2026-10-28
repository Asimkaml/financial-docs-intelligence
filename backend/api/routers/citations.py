from pathlib import Path

import fitz  # PyMuPDF -- already a project dependency, see utils.py
from fastapi import APIRouter, Depends, HTTPException, Response

import config
from api.deps import get_rag_system
from core.rag_system import RAGSystem

router = APIRouter(prefix="/citations", tags=["citations"])


@router.get("/{source}/pages/{page}/image")
def get_page_image(
    source: str,
    page: str,  # a Citation's `page` is a float (e.g. "1.0") -- parsed below rather than typed `int`
    dpi: int = 150,
    rag_system: RAGSystem = Depends(get_rag_system),
):
    """Rasterizes one page of a previously-ingested PDF so the frontend can
    draw a citation's bounding box on top of it.

    bbox_x/y/w/h on a Citation and the width/height returned here are both
    in LlamaParse's own page-coordinate space (captured together at
    ingestion -- see ingestion/parsers.py), which is NOT the same as this
    PNG's pixel size. The frontend must scale the box itself:

        scale_x = X-Rendered-Width  / X-Page-Width
        scale_y = X-Rendered-Height / X-Page-Height
        displayed_box = { x: bbox_x * scale_x, y: bbox_y * scale_y,
                           w: bbox_w * scale_x, h: bbox_h * scale_y }
    """
    try:
        page = int(float(page))  # accepts "1" or "1.0" -- Citation.page comes back as a float from /chat
    except ValueError:
        raise HTTPException(status_code=400, detail=f"'{page}' is not a valid page number.")
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    dpi = max(72, min(dpi, 300))  # guard against absurd memory use from an arbitrary client-supplied dpi

    dims = rag_system.duckdb.get_page_dimensions(source, page)
    if dims is None:
        raise HTTPException(
            status_code=404,
            detail=f"No stored page dimensions for '{source}' page {page} -- was it ingested after Phase 1 shipped?",
        )

    pdf_path = Path(config.PDF_DIR) / source
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"Source PDF '{source}' not found on disk.")

    try:
        doc = fitz.open(pdf_path)
        try:
            if page > doc.page_count:
                raise HTTPException(
                    status_code=404, detail=f"'{source}' only has {doc.page_count} page(s)."
                )
            pdf_page = doc.load_page(page - 1)  # fitz is 0-indexed; our page numbers are 1-indexed throughout
            zoom = dpi / 72  # fitz renders at 72 dpi by default
            pixmap = pdf_page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            png_bytes = pixmap.tobytes("png")
        finally:
            doc.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not render page: {exc}") from exc

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "X-Page-Width": str(dims["width"]),
            "X-Page-Height": str(dims["height"]),
            "X-Rendered-Width": str(pixmap.width),
            "X-Rendered-Height": str(pixmap.height),
        },
    )
