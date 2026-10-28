# Financial RAG Assistant

An agentic Retrieval-Augmented Generation backend for researching company financial statements (built around Pakistan Stock Exchange filings). Upload a filing PDF, ask questions in natural language, and get answers that cite the exact source page, with a bounding box for figures taken from tables.

Built with **LangGraph**, **LangChain**, **Qdrant** (narrative text), **DuckDB** (tables), **LlamaParse** (PDF parsing) and **FastAPI**. A separate React frontend consumes the API; it is not part of this repository.

## Table of Contents

[Architecture](#architecture) | [Ingestion Pipeline](#ingestion-pipeline) | [Agent Graph](#agent-graph) | [Citation Tracking](#citation-tracking) | [REST API](#rest-api) | [Project Structure](#project-structure) | [Configuration](#configuration) | [Setup and Running](#setup-and-running) | [Observability](#observability) | [Development Utilities](#development-utilities) | [Known Limitations](#known-limitations) | [Troubleshooting](#troubleshooting)

---

## Architecture

```
                        ┌─ tables ───────────────► DuckDB (filing_tables, exact lookup)
PDF ──► LlamaParse ─────┤                                       │
                        ├─ page sizes ───────────► DuckDB (document_pages)
                        │                                       │
                        └─ narrative markdown ──► parent/child chunking
                                                    ├─ parents ► parent_store/ (JSON files)
                                                    └─ children ► Qdrant (dense + BM25 hybrid)

Question ──► LangGraph agent ──► tools: search_filing_tables ─────► DuckDB
                                        search_child_chunks ─────► Qdrant
                                        retrieve_parent_chunks ──► parent_store/
                         └─► answer + Sources + citations (source, page, bbox)
```

Key design decisions:

- **Tables and narrative are stored separately.** Financial tables go to DuckDB as whole tables (markdown + CSV) so figures are exact lookups rather than fuzzy embedding matches. Narrative text is chunked and embedded for semantic search. Tables are excluded from the narrative markdown, so the text splitter can never cut a table in half.
- **Parent/child chunking.** Small child chunks (500 characters) are searched; each links to a larger parent chunk (2,000 to 4,000 characters) the agent can fetch for context.
- **Hybrid retrieval.** Qdrant combines dense embeddings (`Qwen/Qwen3-Embedding-0.6B`) with sparse BM25 (`Qdrant/bm25`).
- **Citations come from tool results, never from LLM text.** See [Citation Tracking](#citation-tracking).

---

## Ingestion Pipeline

`FinancialIngestionPipeline` (`ingestion/pipeline.py`) runs per PDF:

1. **Parse** with `DocumentParser` (`ingestion/parsers.py`). LlamaParse (agentic tier, with a prompt tuned for financial statements) is the primary parser. Docling is an optional fallback, disabled by default (`DOCLING_ENABLED = False`).
2. **Split the result.** Each page item is either narrative or a table:
   - Narrative items become markdown, with a `<!--page:N-->` marker at the start of each page.
   - `table` and `chart` items (LlamaParse sometimes labels tables as charts) become `ParsedTable` records: markdown, CSV, page number, and bounding box (`bbox_x/y/w/h`, taken from the region labelled `table` or `chart`).
   - Each table's caption is built from the consecutive run of heading items that precedes it (headings in these filings are flat, so level-based nesting is not used). If there is no heading, the caption falls back to `Table (page N)`.
   - Each page's width and height are recorded.
3. **Store tables and page sizes** in DuckDB.
4. **Copy the source PDF** into `PDF_DIR` so pages can be rendered later for citations.
5. **Write the narrative markdown** to `MARKDOWN_DIR`, chunk it (`document_chunker.py`), save parents to the parent store and index children in Qdrant.
6. **Roll back on failure.** If any step fails, the DuckDB rows, the markdown file and the copied PDF for that document are removed so the upload can be retried. A failure in one file does not stop the rest of a batch.

`DocumentManager` (`core/document_manager.py`) is the entry point used by the API. PDFs go through the pipeline above. Plain `.md` uploads skip parsing and table extraction and are chunked directly (they therefore have no page numbers). A document whose markdown file already exists is skipped (duplicate detection is by filename only).

### Chunking

`DocumentChunker` splits markdown on `#`, `##`, `###` headers, merges parents smaller than `MIN_PARENT_SIZE`, splits parents larger than `MAX_PARENT_SIZE`, and rebalances small neighbours. Page markers are read from each parent to set `page_start` and `page_end` metadata, then stripped from the text. Child chunks inherit their parent's page range.

---

## Agent Graph

The agent is a LangGraph state graph (`rag_agent/graph.py`) with an in-memory checkpointer keyed by `thread_id`.

**Main graph**

| Node | Role |
|------|------|
| `summarize_history` | Folds older conversation turns into a rolling summary; keeps the last few raw messages (`MAIN_HISTORY_MESSAGES_TO_KEEP`) |
| `rewrite_query` | Rewrites the question into one or more self-contained questions (structured output: `QueryAnalysis`), or decides it needs clarification |
| `request_clarification` | Interrupt point. The graph pauses here (`interrupt_before`) until the user replies; the unresolved question and replies are combined on the next pass |
| `agent` (subgraph) | One run per rewritten question, fanned out in parallel with `Send()` |
| `aggregate_answers` | Synthesises the sub-answers into one reply and reconciles citations |

**Agent subgraph**: `orchestrator` (LLM with tools) → `tools` → `should_compress_context` → back to `orchestrator`, until the LLM answers or a limit is reached. `compress_context` summarises and prunes old tool messages when the context grows past a token threshold. `fallback_response` produces a best-effort answer if iteration or tool-call limits (`MAX_ITERATIONS`, `MAX_TOOL_CALLS`) are hit. `collect_answer` packages the result.

**Tools** (`rag_agent/tools.py`)

| Tool | Source | Use |
|------|--------|-----|
| `search_filing_tables(source, caption_contains)` | DuckDB | Exact figures from financial statements. Returns whole matching tables |
| `search_child_chunks(query, limit)` | Qdrant | Hybrid search over narrative text |
| `retrieve_parent_chunks(parent_id)` | Parent store | Fuller context for a relevant child result |

Each tool returns `(content, citations)`. The content goes to the LLM; the citations travel separately.

**LLM providers** (`core/rag_system.py`): Ollama (default model `granite4.1:8b`) and Google Gemini. The active provider is `LLM_PROVIDER` in `config.py` and can be changed at runtime through the API. Gemini can return message content as a list of parts instead of a string; `LLMContentNormalizer` (`core/llm_content.py`) flattens it to text everywhere content is concatenated.

**Prompts** (`rag_agent/prompts.py`) cover summarisation, query rewriting, the orchestrator (tool routing and guardrails against freehand valuation arithmetic), fallback, context compression and aggregation. The aggregation prompt requires a `Sources:` list of filenames.

---

## Citation Tracking

Every answer carries structured citations so a user can see exactly where a figure came from.

1. **Capture at ingestion.** Table pages and bounding boxes, plus each page's width and height, are stored in DuckDB; the source PDF is kept on disk.
2. **Capture at retrieval.** Tools are registered with `response_format="content_and_artifact"`. The citation list rides on `ToolMessage.artifact`, never in the text the LLM sees, so the model cannot invent a citation.
3. **Accumulate.** `AgentState.citations` uses a de-duplicating reducer (`accumulate_citations`). A reducer on state, rather than recomputing from messages, is needed because `compress_context` deletes old tool messages.
4. **Reconcile.** `aggregate_answers` parses the LLM's own `Sources:` block and keeps only citations whose `source` filename appears in it. This is deliberately fail-closed: if the LLM omits or malforms the block, no citations are returned.
5. **Serve.** `POST /api/chat` returns `citations` and `sources`; `GET /api/citations/.../image` returns the rendered page so the frontend can draw the box.

Citation shapes:

| `kind` | Fields |
|--------|--------|
| `table` | `source`, `page`, `caption`, `bbox_x`, `bbox_y`, `bbox_w`, `bbox_h` |
| `narrative` | `source`, `parent_id`, `page_start`, `page_end` (no bounding box) |

Bounding boxes and the stored page width and height share LlamaParse's coordinate space, which is not the rendered image's pixel size. The page-image endpoint returns both so the frontend can scale (see below).

---

## REST API

FastAPI app in `main.py`; routers in `api/routers/`; all routes are under `/api`. Interactive docs are at `/docs` when running.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/chat` | Ask a question |
| `POST` | `/api/documents` | Upload files (async job) |
| `GET` | `/api/documents/jobs/{job_id}` | Poll an upload job |
| `GET` | `/api/documents` | List ingested documents |
| `DELETE` | `/api/documents/{name}` | Delete one document from every store |
| `DELETE` | `/api/documents/{name}` | Delete one document from every store |
| `POST` | `/api/documents/clear` | Delete all ingested data |
| `GET` | `/api/config/llm` | Current provider and model |
| `POST` | `/api/config/llm` | Switch provider/model |
| `GET` | `/api/citations/{source}/pages/{page}/image` | Rendered page PNG |

### Chat

```
POST /api/chat   { "message": "...", "thread_id": "optional" }
→ { "thread_id", "answer", "sources": [...], "citations": [...], "needs_clarification": false }
```

Omit `thread_id` on the first message and reuse the returned one afterwards. If `needs_clarification` is true, `answer` is a clarifying question; the next message on the same thread answers it. The call is a single request/response (no streaming).

### Documents

Uploading is asynchronous because parsing can take a minute or more.

```bash
curl -X POST http://localhost:8000/api/documents -F "files=@/path/to/filing.pdf"
# 202 → { "job_id": "...", "status": "pending" }

curl http://localhost:8000/api/documents/jobs/<job_id>
# → { "status": "pending|running|done|error", "added", "skipped", "documents": [...], "error": null }
```

The multipart field must be named `files` (repeatable). Ingestion runs on a background worker thread, so the server stays responsive. Clients should poll until `done` before querying the new document. Job state lives in memory and is lost on restart.

**Deleting one document.** `DELETE /api/documents/{name}` (use a name from `GET /api/documents`) removes it from every store: Qdrant child chunks (filtered on `metadata.source`), parent-store JSON files, DuckDB tables and page sizes, the markdown file and the stored PDF. It returns `{ "deleted", "child_chunks", "parent_chunks", "tables" }` (counts removed), 404 if the name isn't ingested, and 400 if it isn't a bare filename. The parent store is cleared last because the document list is derived from it: if a step fails, the document stays listed and the delete can be retried (every step is idempotent). Once deleted, the same filename can be uploaded again.

### Deleting documents

```
DELETE /api/documents/{name}      (name = the filename shown by GET /api/documents, URL-encoded)
→ { "deleted": "filing.pdf", "child_chunks": 120, "parent_chunks": 18, "tables": 6 }
```

Removes the document from every store: Qdrant child chunks (filter on `metadata.source`), parent chunks, DuckDB tables and page dimensions, the saved PDF, and the markdown file. The parent store is cleared last because the document list is built from it; if a step fails the response is a 500, the document stays listed, and the delete can be retried (every step is idempotent). Responses: `404` unknown document, `400` name is not a bare filename, `409` an ingestion is running. `POST /documents/clear` also returns 409 while an ingestion is running.

### LLM configuration

```
POST /api/config/llm   { "provider": "ollama" | "gemini", "model": "...", "api_key": "optional, gemini only" }
→ { "provider", "model", "has_api_key" }
```

The key is held in the process environment (`GOOGLE_API_KEY`) for the life of the process and is never returned or written to disk; `has_api_key` only reports whether one is set. Changes are in-memory and revert to `config.py` on restart. Switching rebuilds the agent graph, which creates a new checkpointer, so **all in-progress conversations are dropped**.

### Page images

```
GET /api/citations/{source}/pages/{page}/image?dpi=150
```

Returns a PNG plus headers `X-Page-Width`, `X-Page-Height` (the bbox coordinate space) and `X-Rendered-Width`, `X-Rendered-Height` (actual pixels). Scale a citation's box with `scaleX = X-Rendered-Width / X-Page-Width` (likewise Y). `page` accepts `1` or `1.0`. `dpi` is clamped to 72 to 300. Returns 404 if the PDF or the page's stored dimensions are missing (for example, documents ingested before page dimensions were recorded).

CORS allows `http://localhost:5173` (edit in `main.py`) and exposes the four `X-*` headers.

---

## Project Structure

```
main.py                      FastAPI app: lifespan builds RAGSystem + DocumentManager once
config.py                    Central configuration
document_chunker.py          Parent/child chunking, page-range annotation
utils.py                     Directory helpers, token estimation (tiktoken), pymupdf helpers

api/
  deps.py                    Depends() accessors for the shared RAGSystem / DocumentManager
  schemas.py                 Pydantic request/response models
  routers/
    chat.py                  POST /chat
    documents.py             Upload jobs, list, delete one, clear all
    config.py                LLM provider configuration
    citations.py             Page image rendering

core/
  rag_system.py              Builds managers, LLM and agent graph; reconfigure_llm()
  document_manager.py        Routes uploads (PDF → pipeline, .md → direct chunking); delete one / clear all; ingestion lock
  llm_content.py             LLMContentNormalizer (provider content shapes → str)
  execution_logger.py        Optional colourised graph/tool tracing to the terminal
  observability.py           Optional Langfuse tracing

ingestion/
  parsers.py                 LlamaParse / Docling parsing, table + page-size extraction
  pipeline.py                FinancialIngestionPipeline
  test_ingest.py             CLI to run ingestion on PDFs directly
  test_duckdb.py             DuckDB check script
  metadata_extractor.py      Filename-based metadata heuristic (currently unused)

db/
  vector_db_manager.py       Qdrant client, embeddings, hybrid vector store (incl. delete by source)
  parent_store_manager.py    JSON-file store for parent chunks (incl. delete by source)
  duckdb_manager.py          filing_tables and document_pages

rag_agent/
  graph.py                   Graph construction and compilation
  graph_state.py             State schemas and reducers (incl. citations)
  nodes.py                   Node implementations
  edges.py                   Routing (clarification, tool loop, fallback)
  tools.py                   The three retrieval tools
  prompts.py                 All system prompts
  schemas.py                 QueryAnalysis structured output
```

### DuckDB schema

`filing_tables`: `id`, `source`, `metadata`, `table_markdown`, `table_csv`, `table_caption`, `page`, `bbox_x`, `bbox_y`, `bbox_w`, `bbox_h`.
`document_pages`: `source`, `page`, `width`, `height` (primary key `source, page`).
Schema creation is non-destructive: existing data survives restarts. `delete_by_source` removes a document's tables and page dimensions.

---

## Configuration

Settings are in `config.py`. Secrets come from environment variables (a `.env` file is loaded automatically).

**Environment variables**

| Variable | Purpose |
|----------|---------|
| `LLAMA_CLOUD_API_KEY` | LlamaParse (required to ingest PDFs unless Docling is enabled) |
| `GOOGLE_API_KEY` | Gemini (can also be set at runtime via the API) |
| `HF_TOKEN` | Optional Hugging Face token for model downloads |
| `LANGFUSE_ENABLED`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` | Optional tracing |

**Key settings**

| Setting | Default | Meaning |
|---------|---------|---------|
| `LLM_PROVIDER` | `"gemini"` | `"gemini"` or anything else for Ollama |
| `GEMINI_MODEL` / `LLM_MODEL` | `gemini-3.1-flash-lite` / `granite4.1:8b` | Model per provider |
| `LLM_TEMPERATURE`, `LLM_SEED` | `0`, `42` | Generation settings |
| `DENSE_MODEL`, `SPARSE_MODEL` | `Qwen/Qwen3-Embedding-0.6B`, `Qdrant/bm25` | Embeddings |
| `CHILD_CHUNK_SIZE` / `CHILD_CHUNK_OVERLAP` | `500` / `100` | Child chunking |
| `MIN_PARENT_SIZE` / `MAX_PARENT_SIZE` | `2000` / `4000` | Parent chunking |
| `RETRIEVAL_SCORE_THRESHOLD`, `DEFAULT_RETRIEVAL_K` | `0.4`, `7` | Retrieval |
| `MAX_TOOL_CALLS`, `MAX_ITERATIONS`, `GRAPH_RECURSION_LIMIT` | `8`, `10`, `50` | Agent loop limits |
| `MAIN_HISTORY_MESSAGES_TO_KEEP` | `4` | Raw messages kept between turns (minimum 2) |
| `BASE_TOKEN_THRESHOLD`, `TOKEN_GROWTH_FACTOR` | `2000`, `0.9` | Context compression |
| `DOCLING_ENABLED` | `False` | Docling fallback parser |
| `EXECUTION_LOGGING_ENABLED` | `False` | Terminal tracing of graph steps and tools |

**Data directories** (`MARKDOWN_DIR`, `PDF_DIR`, `PARENT_STORE_PATH`, `QDRANT_DB_PATH`, `DUCKDB_PATH`) are resolved relative to the **parent of the directory containing `config.py`**, not the repository root: `markdown_docs/`, `source_docs/`, `parent_store/`, `qdrant_db/`, `duckdb/filings.duckdb`. Changing the embedding model requires clearing and re-indexing, because the Qdrant vector size must match (startup raises a clear error otherwise).

---

## Setup and Running

There is no `requirements.txt` in the repository at present. The code imports: `fastapi`, `uvicorn`, `python-multipart`, `pydantic`, `langgraph`, `langchain-core`, `langchain-text-splitters`, `langchain-huggingface`, `langchain-qdrant`, `langchain-ollama`, `langchain-google-genai` (for Gemini), `qdrant-client`, `fastembed`, `duckdb`, `pandas`, `pymupdf`, `pymupdf4llm`, `llama-cloud`, `tiktoken`, `python-dotenv`, and optionally `langfuse` and `docling`. Python 3.11+ (the repository was developed on 3.11).

```bash
# 1. create .env
LLAMA_CLOUD_API_KEY=...
GOOGLE_API_KEY=...          # if using Gemini

# 2. run (from the repository root)
uvicorn main:app --reload --port 8000
```

Startup (the FastAPI lifespan) loads the embedding model, connects to Qdrant and DuckDB, and compiles the agent graph, so it takes a few seconds. The chat LLM is not loaded at startup: Gemini needs no local weights, and Ollama loads its model on the first request. For Ollama, run `ollama serve` and pull the configured model first.

Typical first session:

```bash
curl -X POST http://localhost:8000/api/documents -F "files=@filing.pdf"      # get job_id
curl http://localhost:8000/api/documents/jobs/<job_id>                        # until "done"
curl -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" \
     -d '{"message": "What was the gross profit for the six months?"}'
```

---

## Observability

Optional Langfuse tracing (`core/observability.py`) records LLM calls, tool calls and graph transitions. Enable it with `LANGFUSE_ENABLED=true` plus the public and secret keys (see `.env.example`). If keys are missing or authentication fails, tracing is skipped and the app runs normally. Separately, `EXECUTION_LOGGING_ENABLED = True` prints graph steps, state previews and tool inputs/outputs to the terminal.

---

## Development Utilities

Run ingestion without the API, useful for checking parser quality on a real filing:

```bash
python -m ingestion.test_ingest path/to/statement.pdf [more.pdf ...]
```

It reports counts and prints the tables now in DuckDB.

---

## Known Limitations

- **Duplicate detection is by filename only.** Identical content under a different name is ingested again.
- **Narrative page ranges are approximate.** They are recorded per parent chunk, so a citation can span several pages, and a chunk that starts mid-page before a page marker can be attributed to the later page. Narrative citations have no bounding box.
- **Tables are stored whole**, not as individual line items. The agent reads figures out of the returned table; there are no structured line items or valuation tools (DCF, P/E) yet.
- **Single instance.** One global `RAGSystem`; conversation state, upload jobs and runtime LLM settings are in memory only. Switching the LLM drops active conversations. Ingestion, delete and clear share one lock in `DocumentManager`: concurrent uploads run one at a time, and delete/clear refuse (409) while one is running.
- **Deleting a document mid-conversation** leaves earlier answers' citations pointing at it; their page-image requests return 404. Deleting while that same file is still being ingested is not guarded.
- **Citations are fail-closed.** If the LLM's answer lacks a well-formed `Sources:` list, no citations are returned for it.
- **Ingestion depends on LlamaParse** (network and API key) unless Docling is enabled. The raw-output debug dump in `parsers.py` writes next to the repository's parent directory.
- **Leftover files.** `app.py`, `ui/`, `assets/` and `core/chat_interface.py` are from the earlier Gradio interface and are unused. The `Dockerfile` still targets the Gradio layout and does not work for the current FastAPI app. `ingestion/metadata_extractor.py` is not wired in.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Vector size mismatch` on startup | Qdrant collection built with a different embedding model | Clear the collection (delete `qdrant_db/`) and re-ingest |
| Upload job ends in `error` | LlamaParse key missing or invalid, parse failed, or no narrative chunks were produced | Read the job's `error`; check `LLAMA_CLOUD_API_KEY` |
| 422 on `POST /api/documents` | Multipart field not named `files`, or `python-multipart` missing | Use `-F "files=@..."`; install `python-multipart` |
| Chat returns no citations | LLM omitted the `Sources:` block, or the answer used no retrieved evidence | Expected (see Known Limitations); check the answer text |
| Delete returns 500 | A store failed partway (e.g. Qdrant unavailable) | The document is still listed; fix the cause and call DELETE again |
| Page image 404 | Document ingested before page sizes were recorded, or the PDF file is missing from `source_docs/` | Re-ingest the document |
| Browser cannot read `X-Page-Width` | Frontend origin differs from the CORS allow-list | Update `allow_origins` in `main.py` |
| `TypeError: can only concatenate str (not "list")` | Provider returned list-shaped message content | Handled by `LLMContentNormalizer`; use it in any new code that concatenates `.content` |
| Gemini rate-limit errors | Free-tier request limits | Wait, or switch model/provider via `/api/config/llm`; the client is set to `max_retries=1` |
| `409` on delete or clear | An ingestion is still running | Wait for the upload job to reach `done`, then retry |
| Old conversation stops working after switching LLM | The agent graph (and its checkpointer) was rebuilt | Start a new thread (omit `thread_id`) |

### References:  

https://github.com/GiovanniPasq/agentic-rag-for-dummies
