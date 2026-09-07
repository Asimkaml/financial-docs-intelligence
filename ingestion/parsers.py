
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import config

# --- debugging ---
# _BASE_DIR = Path(__file__).resolve().parent.parent

# LLAMAPARSE_OUTPUT_DIR = _BASE_DIR.parent / "llamaparse_output"
# LLAMAPARSE_RAW_DIR = LLAMAPARSE_OUTPUT_DIR / "raw"
# LLAMAPARSE_TABLES_DIR = LLAMAPARSE_OUTPUT_DIR / "tables"

# LLAMAPARSE_RAW_DIR.mkdir(parents=True, exist_ok=True)
# LLAMAPARSE_TABLES_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class ParsedTable:
    caption: str
    markdown: str
    csv: str
    page: Optional[int] = None
    bbox_x: Optional[float] = None
    bbox_y: Optional[float] = None
    bbox_w: Optional[float] = None
    bbox_h: Optional[float] = None


@dataclass
class ParsedDocument:
    # file_hash: Optional[str] 
    markdown_text: str
    tables: List[ParsedTable] = field(default_factory=list)
    parser_used: str = ""


class DocumentParser:
    def __init__(self):
        self._llamaparse_client = self._init_llamaparse()
        self._docling_converter = self._init_docling()

        if self._llamaparse_client is None and self._docling_converter is None:
            print(
                "⚠️  No parser available. Set LLAMA_CLOUD_API_KEY in your environment "
                "or `pip install docling` for the offline fallback."
            )

    # -- setup -----------------------------------------------------------

    def _init_llamaparse(self):
        if not config.LLAMA_CLOUD_API_KEY:
            return None
        try:
            from llama_cloud  import LlamaCloud
        except ImportError:
            print("llama-cloud not installed (`pip install llama-cloud`) -- skipping.")
            return None

        return LlamaCloud(
            api_key=config.LLAMA_CLOUD_API_KEY,
        )

    def _init_docling(self):
        if not config.DOCLING_ENABLED:
            return None
        try:
            from docling.document_converter import DocumentConverter
        except ImportError:
            print("docling not installed (`pip install docling`) -- no fallback parser.")
            return None
        return DocumentConverter()

    # -- public API --------------------------------------------------------

    def parse(self, pdf_path) -> ParsedDocument:
        pdf_path = Path(pdf_path)

        if self._llamaparse_client is not None:
            try:
                return self._parse_with_llamaparse(pdf_path)
            except Exception as e:
                print(f"LlamaParse failed for {pdf_path.name}: {e}. Falling back to Docling.")

        if self._docling_converter is not None:
            try:
                return self._parse_with_docling(pdf_path)
            except Exception as e:
                raise RuntimeError(
                    f"Both LlamaParse and Docling failed to parse {pdf_path.name}."
                ) from e

        raise RuntimeError(
            f"No parser available for {pdf_path.name}. "
        )

    def get_table_bbox(self,item):
        """item.bbox is a list of regions (e.g. caption + table)"""
        try:
            for entry in getattr(item, "bbox", None) or []:
                if entry.label == "table" or entry.label == "chart":
                    return entry
        except Exception:
            print(f"Error occurred while processing table bounding box: {Exception}")    
        return {}


    # -- LlamaParse --------------------------------------------------------

    def get_llamaparse_output(self, pdf_path: Path):
        
        client = self._llamaparse_client

        uploaded = client.files.create(file=str(pdf_path), purpose="parse")
        result = client.parsing.parse(
            file_id=uploaded.id,
            tier="agentic",  # strong table accuracy; see Tiers guide for agentic_plus/cost_effective/fast
            version="latest",
            agentic_options={
                "custom_prompt": "This is a company financial statement (annual or quarterly report, possibly IFRS-format). Preserve every table exactly as rows and columns, including headers, units (thousands/millions), and currency labels. Do not summarize or omit numeric tables. Keep statement names (e.g. Statement of Financial Position, Profit and Loss) as headings."
            },
            processing_options={"cost_optimizer": {"enable": True}},
            expand=["markdown", "items"],
        )

        if result.job.status != "COMPLETED":
            raise RuntimeError(f"LlamaParse job ended as {result.job.status}")

        return result

    def process_parsed_document(self, result):
        """turns a completed LlamaParse result into markdown + tables."""
        markdown_text = "\n\n".join(
            f"{config.PAGE_MARKER.format(page.page_number)}\n{page.markdown}"
            for page in result.markdown.pages
        )

        tables = []
        for page in result.items.pages:
            for item in page.items:
                if getattr(item, "type", None) != "table":
                    continue
                caption = getattr(item, "caption", None) or f"Table (page {page.page_number})"
                bbox = self.get_table_bbox(item)
  
                tables.append(ParsedTable(
                    caption=caption, markdown=item.md, csv=item.csv, page=page.page_number,
                    bbox_x=bbox.x if bbox else None, bbox_y=bbox.y if bbox else None,
                    bbox_w=bbox.w if bbox else None, bbox_h=bbox.h if bbox else None,
                ))
        #saving tables to llama_tables  directory in json format (will be removed later)
        # import json
        # import dataclasses

        # table_file_path = LLAMAPARSE_TABLES_DIR / f"t.json"
        # with open(table_file_path, "w", encoding="utf-8") as f:
        #     json.dump([dataclasses.asdict(t) for t in tables], f, ensure_ascii=False, indent=4)
        # exit()


        return ParsedDocument(markdown_text=markdown_text, tables=tables, parser_used="llamaparse")

    def _parse_with_llamaparse(self, pdf_path: Path) -> ParsedDocument:
        result = self.get_llamaparse_output(pdf_path)

        return self.process_parsed_document(result)
    # -- Docling -------------------------------------------------------------

    def _parse_with_docling(self, pdf_path: Path) -> ParsedDocument:
        result = self._docling_converter.convert(str(pdf_path))
        markdown_text = result.document.export_to_markdown()

        tables = []
        for i, table in enumerate(getattr(result.document, "tables", [])):
            try:
                table_md = table.export_to_markdown(result.document)
            except Exception:
                continue
            caption = getattr(table, "caption_text", None) or f"Table {i + 1}"
            tables.append(ParsedTable(caption=str(caption)[:120], markdown=table_md))

        return ParsedDocument(markdown_text=markdown_text, tables=tables, parser_used="docling")