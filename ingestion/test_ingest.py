"""
Run the ingestion pipeline directly, no Gradio involved.

Usage:
    cd project
    python -m ingestion.test_ingest path/to/statement.pdf [more.pdf ...]

Prints which parser was used, how many tables were extracted into DuckDB,
and how many narrative chunks were indexed into Qdrant -- useful for
checking LlamaParse/Docling quality on a real filing before wiring it
into the full agent.
"""

import sys
from pathlib import Path

from core.rag_system import RAGSystem
from ingestion.pipeline import FinancialIngestionPipeline
from ingestion.metadata_extractor import infer_metadata


def main(pdf_paths):
    rag_system = RAGSystem()
    rag_system.initialize()  # compiles the agent graph too; only chunker/parent_store/vector_db are used here

    pipeline = FinancialIngestionPipeline(rag_system)

    for pdf_path in pdf_paths:
        pdf_path = Path(pdf_path)
        print(f"\n--- {pdf_path.name} ---")

        metadata = infer_metadata(pdf_path, pdf_path.name)
        print(f"Inferred metadata: company={metadata.company!r} "
              f"period_type={metadata.period_type} fiscal_period={metadata.fiscal_period} "
              f"currency={metadata.currency}")
        print("(check this looks right -- it's filename-based and easy to get wrong)")

    added, skipped, errors = pipeline.ingest(pdf_paths, progress_callback=lambda p, desc: print(f"  {desc}"))
    print(f"\nDone. Added: {added}  Skipped: {skipped}")
    for name, err in errors:
        print(f"  ✗ {name}: {err}")

    print("\nTables now in DuckDB:")
    print(pipeline.duckdb.query_tables())


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
