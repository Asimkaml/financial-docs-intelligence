import shutil
import tempfile
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile

from api.deps import get_document_manager
from api.schemas import ClearResponse, DeleteResponse, DocumentOut, JobStatus, UploadJobResponse
from core.document_manager import DocumentManager

router = APIRouter(prefix="/documents", tags=["documents"])

# Job store (app.state.ingestion_jobs) is a plain in-memory dict, set up in
# main.py's lifespan. That means jobs vanish on restart and this won't scale
# past a single server process -- fine for the current single-instance
# RAGSystem assumption, not fine if this is ever run with multiple workers.


def _run_ingestion_job(
    jobs: dict,
    job_id: str,
    tmp_dir: str,
    tmp_paths: List[str],
    document_manager: DocumentManager,
) -> None:
    """Runs on a worker thread via BackgroundTasks (Starlette offloads plain
    `def` background callables automatically) -- the blocking LlamaParse /
    DuckDB / Qdrant chain in add_documents() no longer freezes the event loop
    for other requests while this runs."""
    jobs[job_id]["status"] = "running"
    try:
        added, skipped = document_manager.add_documents(tmp_paths)
        jobs[job_id].update(
            status="done",
            added=added,
            skipped=skipped,
            documents=document_manager.get_markdown_files(),
        )
    except Exception as exc:
        jobs[job_id].update(status="error", error=str(exc))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("", response_model=UploadJobResponse, status_code=202)
async def upload_documents(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    document_manager: DocumentManager = Depends(get_document_manager),
):
    # Not a context-managed TemporaryDirectory -- it has to outlive this
    # request, since the background task reads from it after we return.
    # _run_ingestion_job cleans it up itself once ingestion finishes.
    tmp_dir = tempfile.mkdtemp(prefix="upload_")
    tmp_paths = []
    for upload in files:
        dest = Path(tmp_dir) / upload.filename
        with dest.open("wb") as out:
            shutil.copyfileobj(upload.file, out)
        tmp_paths.append(str(dest))

    job_id = str(uuid.uuid4())
    request.app.state.ingestion_jobs[job_id] = {
        "status": "pending",
        "added": 0,
        "skipped": 0,
        "documents": [],
        "error": None,
    }

    background_tasks.add_task(
        _run_ingestion_job,
        request.app.state.ingestion_jobs,
        job_id,
        tmp_dir,
        tmp_paths,
        document_manager,
    )

    return UploadJobResponse(job_id=job_id)


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job_status(job_id: str, request: Request):
    job = request.app.state.ingestion_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id.")
    return JobStatus(job_id=job_id, **job)


@router.get("", response_model=List[DocumentOut])
def list_documents(document_manager: DocumentManager = Depends(get_document_manager)):
    return [DocumentOut(name=name) for name in document_manager.get_markdown_files()]


@router.delete("/{name}", response_model=DeleteResponse)
def delete_document(name: str, document_manager: DocumentManager = Depends(get_document_manager)):
    try:
        return DeleteResponse(**document_manager.delete_document(name))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"No ingested document named '{name}'.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Delete of '{name}' did not finish ({exc}). The document is still listed; retry the delete.",
        )


@router.post("/clear", response_model=ClearResponse)
def clear_documents(document_manager: DocumentManager = Depends(get_document_manager)):
    document_manager.clear_all()
    return ClearResponse()
