from pathlib import Path
import shutil
import config
from utils import clear_directory_contents
from ingestion.pipeline import FinancialIngestionPipeline

class DocumentManager:

    def __init__(self, rag_system):
        self.rag_system = rag_system
        self.markdown_dir = Path(config.MARKDOWN_DIR)
        self.markdown_dir.mkdir(parents=True, exist_ok=True)
        self.pipeline = FinancialIngestionPipeline(rag_system)

    def add_documents(self, document_paths, progress_callback=None):
        if not document_paths:
            return 0, 0

        document_paths = [document_paths] if isinstance(document_paths, str) else document_paths
        document_paths = [p for p in document_paths if p and Path(p).suffix.lower() in [".pdf", ".md"]]

        if not document_paths:
            return 0, 0

        pdf_paths, md_paths = [], []
        for p in document_paths:
            source_path = Path(p)
            md_path = self.markdown_dir / f"{source_path.stem}.md"
            if md_path.exists():
                continue
            (pdf_paths if source_path.suffix.lower() == ".pdf" else md_paths).append(source_path)

        skipped = len(document_paths) - len(pdf_paths) - len(md_paths)
        added = 0

        # PDFs -> LlamaParse/Docling + table extraction + tagged chunking
        if pdf_paths:
            pdf_added, pdf_skipped, errors = self.pipeline.ingest(
                pdf_paths, progress_callback=progress_callback
            )
            added += pdf_added
            skipped += pdf_skipped
            for name, err in errors:
                print(f"Error processing {name}: {err}")

        # Plain Markdown uploads bypass parsing/table extraction -- no financial
        # metadata tagging or DuckDB table storage happens for these.
        for source_path in md_paths:
            md_path = self.markdown_dir / f"{source_path.stem}.md"
            parent_ids = []
            try:
                shutil.copy(source_path, md_path)
                parent_chunks, child_chunks = self.rag_system.chunker.create_chunks_single(
                    md_path, source_name=source_path.name,
                )
                if not child_chunks:
                    raise ValueError("No child chunks were created.")
                parent_ids = [parent_id for parent_id, _ in parent_chunks]
                self.rag_system.parent_store.save_many(parent_chunks)
                collection = self.rag_system.vector_db.get_collection(self.rag_system.collection_name)
                collection.add_documents(child_chunks)
                added += 1
            except Exception as e:
                self.rag_system.parent_store.delete_many(parent_ids)
                if md_path.exists():
                    md_path.unlink()
                print(f"Error processing {source_path}: {e}")
                skipped += 1

        return added, skipped

    def get_markdown_files(self):
        sources = self.rag_system.parent_store.list_sources()
        if sources:
            return sources
        return sorted(p.name for p in self.markdown_dir.glob("*.md"))

    def clear_all(self):
        self.markdown_dir.mkdir(parents=True, exist_ok=True)
        self.rag_system.vector_db.delete_collection(self.rag_system.collection_name)

        clear_directory_contents(self.markdown_dir)
        self.rag_system.parent_store.clear_store()
        self.pipeline.clear_all()

        self.rag_system.vector_db.create_collection(self.rag_system.collection_name)
