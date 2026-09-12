"""
Financial document ingestion pipeline.

Replaces the plain "PDF -> pymupdf4llm markdown -> chunker" path with:

    PDF -> DocumentParser (LlamaParse / Docling) -> {
        tables      -> DuckDBManager   (exact structured lookup)
        narrative   -> DocumentChunker -> Qdrant + parent store  (semantic search)
    }

Every chunk (parent, child, and table row) is tagged with company,
period_type, fiscal_period so retrieval and valuation tools
can filter by them instead of relying on semantic similarity alone.
"""

from pathlib import Path
from typing import List, Tuple

import config
from ingestion.parsers import DocumentParser
from db.duckdb_manager import DuckDBManager


class FinancialIngestionPipeline:
    """ Ingestion pipeline for financial documents. Handles the complete processing workflow for financial PDFs: parsing the document, extracting metadata and tables, storing structured tables in DuckDB, converting narrative content to Markdown, creating parent/child chunks, and indexing the chunks in the RAG vector database. """
    def __init__(self, rag_system, duckdb_manager: DuckDBManager = None):
        self.rag_system = rag_system
        self.parser = DocumentParser()
        self.duckdb = duckdb_manager or DuckDBManager()
        self.markdown_dir = Path(config.MARKDOWN_DIR)
        self.markdown_dir.mkdir(parents=True, exist_ok=True)

    def ingest(self, pdf_paths, progress_callback=None) -> Tuple[int, int, List[Tuple[str, str]]]:
        """ Ingest multiple financial PDF documents. If one document fails, the pipeline records the error and continues processing the remaining documents. 
        Args:
            pdf_paths: A single PDF path or an iterable of PDF paths. 
            progress_callback: Optional callback used to report ingestion progress. It receives the progress percentage and a status message. 
        Returns: 
            A tuple containing: - added: Number of successfully ingested documents. - skipped: Number of documents that failed to ingest. - errors: List of tuples containing the failed filename and corresponding error message. """
        
        pdf_paths = [pdf_paths] if isinstance(pdf_paths, str) else list(pdf_paths)
        added, skipped, errors = 0, 0, []

        for i, pdf_path in enumerate(pdf_paths):
            pdf_path = Path(pdf_path)
            if progress_callback:
                progress_callback((i + 1) / len(pdf_paths), f"Parsing {pdf_path.name}")
            try:
                self._ingest_single(pdf_path)
                added += 1
            except Exception as e:
                print(f"Failed to ingest {pdf_path.name}: {e}")
                errors.append((pdf_path.name, str(e)))
                skipped += 1

        return added, skipped, errors

    def _ingest_single(self, pdf_path: Path) -> None:
        """ Process and index a single financial PDF."""
        source_name = pdf_path.name
        parsed = self.parser.parse(pdf_path)
        metadata = {}
        md_path = self.markdown_dir / f"{pdf_path.stem}.md"

        try:
            if parsed.tables:
                n = self.duckdb.save_tables(source_name, metadata, parsed.tables)
                print(f"  ↳ {n} table(s) stored in DuckDB for {source_name}")

            md_path.write_text(parsed.markdown_text, encoding="utf-8")

            parent_chunks, child_chunks = self.rag_system.chunker.create_chunks_single(
                md_path, source_name=source_name, extra_metadata=metadata,
            )
            if not child_chunks:
                raise ValueError("No narrative child chunks were created (parser may have returned only tables).")

            self.rag_system.parent_store.save_many(parent_chunks)
            collection = self.rag_system.vector_db.get_collection(self.rag_system.collection_name)
            collection.add_documents(child_chunks)

        except Exception:
            self.duckdb.delete_by_source(source_name)  # roll back any tables already saved
            if md_path.exists():
                md_path.unlink()                        # remove the stale markdown so re-upload can retry
            raise

    def clear_all(self) -> None:
        """ Clear all structured financial data stored in DuckDB."""
        self.duckdb.clear()
