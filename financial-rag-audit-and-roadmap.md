# Financial RAG Pipeline — Code Audit & Phased Roadmap

Scope: `agentic_rag.zip` (current codebase) vs. `suggested_changes.txt` (target architecture: Enterprise Document Intelligence Platform for PSX financial statements).

---

## 1. Issues found in the current implementation

### 1.2 Silent correctness gaps (won't crash, but the feature isn't actually happening)

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| 5 | `ingestion/metadata_extractor.py` | Metadata is inferred purely from the filename (`HBL_Q2_2024.pdf` → company="HBL"). This is documented honestly in the module's own docstring as a "will mislabel inconsistently-named files" heuristic, with no UI correction step yet built. | Fine as an interim measure, but real PSX filings are rarely named this cleanly (e.g. `Q2-2024-Financial-Statements-Unconsolidated.pdf` gives no usable company token). Wrong metadata compounds with issue #4 once tagging is turned on — every mistagged filing pollutes the ability to filter by company/period. |
| 6 | `rag_agent/tools.py` (`ToolFactory`) | Only two tools exist: `search_child_chunks`, `retrieve_parent_chunks`. Neither tool accepts or exposes company/period filters, and there is no financial-data or valuation tool at all. | None of the suggested valuation stack (`calculate_dcf`, `calculate_pe`, `get_market_data`) exists yet — the agent has no way to do arithmetic on filing data, only to quote text back. |
| 7 | `db/duckdb_manager.py` | Each row stores one **entire table as a markdown/CSV blob** (`table_markdown`), not individual line items (e.g. "Net Income", "Total Assets" as their own queryable fields). The module's own docstring acknowledges this is deferred ("parsing individual line items ... is a later step"). | Valuation tools can't do `SELECT net_income FROM ... WHERE company=? AND fiscal_period=?` — they'd have to re-parse a markdown/CSV blob at query time, which is slow and brittle for a repeated "get_market_data"/DCF flow. |
| 8 | `core/rag_system.py` | LLM initialization is hardcoded to `ChatOllama(...)`. The multi-provider factory pattern is fully written up in `README.md` (`LLM_CONFIGS` / `ACTIVE_LLM_CONFIG`) but was never actually applied to `rag_system.py` — the README describes a refactor that hasn't been done. | Matches the suggested changes' open question ("recommend prototyping the valuation tool chain on both a 30B+ local model and an API model") — but right now that A/B isn't even possible without hand-editing code, since there's no config-driven switch. |
| 9 | `db/vector_db_manager.py` | Hybrid dense+sparse retrieval via Qdrant (`RetrievalMode.HYBRID`) **is** implemented — this matches the suggestion. However there is no reranking step anywhere (no `bge-reranker-v2-m3` or Cohere rerank call) between `similarity_search` and returning results to the agent. | Retrieval precision on long, repetitive financial statements (many tables with similar line-item names across periods) will suffer without a rerank pass — this is explicitly called out as a target in the suggested changes and is currently a no-op. |
| 10 | Whole repo | No `psx-data-reader` (or any market-data source) integration, no risk-free-rate (SBP T-bill) source, no `financetoolkit` dependency, and no Langfuse... wait — Langfuse *is* implemented (`core/observability.py`), that one's already done and matches the suggestion. | Everything under "Market data" and "Valuation tools" in the suggested changes is still greenfield — 0% built. This is the largest gap between current state and target. |
| 11 | `ingestion/parsers.py` | `from llama_cloud  import LlamaCloud` has a stray double space (harmless syntactically, but worth cleaning) and there's no handling for LlamaParse's async/job-polling errors beyond a blanket `except Exception`. Not a functional bug — current `client.files.create` / `client.parsing.parse(tier="agentic", ...)` usage matches the current LlamaParse SDK. | Low priority; noted for code hygiene. |
| 12 | `core/document_manager.py` | Plain `.md` uploads bypass the whole financial pipeline (no table extraction, no DuckDB storage, no metadata tagging) — this is called out honestly in a comment. | Acceptable by design, but worth deciding explicitly: should raw `.md` uploads even be allowed for a financial-statement-only tool, or should the upload surface be restricted to PDF so every document goes through the tagging pipeline? |

### 1.3 Summary of current state vs. suggested changes

| Suggested item | Status |
|---|---|
| LlamaParse primary / Docling fallback | ✅ Implemented (bugs #1–#3 aside) |
| Currency normalization (PKR-native) | ✅ `config.DEFAULT_CURRENCY` present, threaded into metadata |
| Metadata tagging at index time (company/period_type/fiscal_period) | ⚠️ Extracted but **not attached to chunks** (#4) |
| DuckDB for tabular data | ⚠️ Table exists but stores whole-table blobs, not line items (#7) |
| Qdrant hybrid dense+sparse retrieval | ✅ Implemented |
| Embeddings (BGE / Qwen open-source) | ✅ Qwen3-Embedding-0.6B is the current default, swappable via config |
| Embeddings (voyage-finance-2 option) | ❌ Not started |
| Reranker (bge-reranker-v2-m3 / Cohere) | ❌ Not started |
| Market data (psx-data-reader) | ❌ Not started |
| Risk-free rate (SBP T-bill) | ❌ Not started |
| Valuation tools (DCF, P/E, get_market_data) | ❌ Not started |
| Multi-LLM orchestration (local vs. API A/B) | ⚠️ Documented in README, not wired into `rag_system.py` |
| Observability (Langfuse, self-hosted) | ✅ Implemented |

---

## 2. Phased Plan to Fulfill the Suggested Changes.
- Add a unit test (`ingestion/test_ingest.py` already exists as a stub) that runs a real PSX PDF through `DocumentParser.parse()` and asserts tables come back with consistent fields.
- Verify metadata now shows up on Qdrant points and DuckDB rows for a small batch of test filings.

*Exit criteria: uploading 3–5 real PSX PDFs (mix of annual/quarterly) completes without exceptions, and each resulting chunk/table row carries the correct company + fiscal_period.*

### Phase 1 — Structured financial data (line items, not blobs)
Goal: make DuckDB queryable by line item, not just by whole-table text.
- Extend `DuckDBManager` schema with a `filing_line_items` table: `(id, source, company, period_type, fiscal_period, currency, statement_type, line_item, value, unit)`.
- Add a line-item extraction step after table parsing — start with a targeted LLM/structured-output pass (Pydantic schema) over each `ParsedTable.csv`, constrained to a known set of statement types (Balance Sheet, Income Statement, Cash Flow) and a controlled vocabulary of line items (Revenue, Net Income, Total Assets, Total Equity, EPS, Shares Outstanding, etc.).
- Keep the existing whole-table storage as a fallback/audit trail; the new table is what tools will query.
- Improve `metadata_extractor.py` beyond filename heuristics: parse the first page/cover of the LlamaParse markdown output for company name and reporting period, falling back to the filename heuristic only when that fails. Surface a manual-correction step in the UI before indexing (per the module's own docstring recommendation).

*Exit criteria: `SELECT value FROM filing_line_items WHERE company=? AND fiscal_period=? AND line_item='Net Income'` returns a correct number for each test filing.*

### Phase 2 — Market data & risk-free rate
Goal: give the valuation tools the external inputs they need beyond the filings themselves.
- Add a `market_data/` module wrapping `psx-data-reader` for current price and shares outstanding, with a thin caching layer (prices don't need to be re-fetched every tool call within a session).
- Add an SBP T-bill risk-free-rate source: either a scraper against SBP's published rates page or a config-supplied override (`RISK_FREE_RATE_OVERRIDE`) for when scraping is unreliable/rate-limited.
- Both should degrade gracefully (clear error message, not a crash) if the network call fails, since these will be called from inside an agent tool loop.

*Exit criteria: `get_market_data(ticker)` returns price + shares outstanding for a known PSX ticker; a risk-free rate is available with a documented fallback.*

### Phase 3 — Valuation tools
Goal: turn Phase 1 + Phase 2 data into the DCF/P/E tools the agent can call.
- Add `calculate_pe(company, fiscal_period)`: pulls EPS from `filing_line_items` + current price from market data.
- Add `calculate_dcf(company, projection_years, growth_rate, discount_rate=None)`: pulls historical cash flows from `filing_line_items`, uses the risk-free rate from Phase 2 as a WACC/discount-rate default if the user doesn't supply one, and uses `financetoolkit` for the underlying DCF math rather than hand-rolling it.
- Register these in `ToolFactory.create_tools()` alongside the existing retrieval tools, with clear docstrings (the agent picks tools by docstring, same pattern as `search_child_chunks`).
- Extend `search_child_chunks` to accept optional `company`/`fiscal_period` filter arguments now that chunks are tagged (Phase 0) — this lets the agent narrow retrieval instead of relying on semantic similarity alone, per the original design intent.
- Add a `get_line_item(company, fiscal_period, line_item)` tool as a lower-level exact-lookup complement to the valuation tools — useful both directly and as a building block the valuation tools call internally.

*Exit criteria: asking the assistant "What's the P/E for <company> as of <period>?" or "Run a DCF for <company>" produces a numeric answer with cited sources (filing + market data), not just narrative text pulled from chunks.*

### Phase 4 — Retrieval quality (embeddings & reranking)
Goal: close the retrieval-precision gap called out in the suggested changes, now that there's a real corpus to test against.
- Prototype `voyage-finance-2` vs. the current `bge`/Qwen open-source embedding on a fixed evaluation set of PSX filing questions; keep BGE as the default/fallback per the suggested changes unless the quality gap clearly justifies the API cost.
- Add a reranking step (`bge-reranker-v2-m3` open-source vs. Cohere hosted rerank, A/B the same way) between `similarity_search` and the tool's return value in `_search_child_chunks`.
- Re-run the same evaluation set through the reranked pipeline and compare precision/recall before deciding which combination becomes default.

*Exit criteria: documented before/after comparison on the eval set; a decision recorded on which embedding+reranker pair is the new default.*

### Phase 5 — LLM orchestration & productionization
Goal: finish the multi-provider wiring the README already documents, and get the app ready to actually deploy.
- Apply the `LLM_CONFIGS` / `ACTIVE_LLM_CONFIG` pattern from the README into `rag_system.py` for real (it's currently only documentation).
- Prototype the full valuation tool chain (Phase 3) on both a local 30B+ model and an API model against real PSX filings, per the suggestion — record which one is reliable enough at multi-step tool orchestration (DCF requires several chained tool calls) before picking a default.
- Only after the above is stable: move to the platform items in `suggested_changes.txt` that aren't RAG-specific — FastAPI backend, Redis, multi-user auth, React/Tailwind frontend, Docker/GitHub Actions/Nginx/AWS deployment, admin dashboard. These are meaningfully separate engineering work from the RAG/valuation core and should not start until Phases 0–4 are stable, since the API/UI layer will otherwise need to be re-shaped around late-discovered tool signatures.

*Exit criteria: a single config change switches the whole valuation pipeline between local and API models without code edits; a go/no-go decision is documented for which model powers the default deployment.*

---

## 3. Suggested immediate next step

Phase 0 is small (a handful of line-level fixes) and unblocks everything else — right now the pipeline cannot successfully ingest a single real financial statement with tables. Recommend doing Phase 0 first, in isolation, before touching any of the new-feature phases.
