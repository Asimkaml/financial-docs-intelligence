"""
Structured store for tables extracted from financial statements.

Vector search (Qdrant) stays for narrative text. Tables go here instead --
so "what was net income in Q2FY2024" is an exact lookup, not a fuzzy
embedding match. Each row is one whole table (balance sheet, income
statement, etc.), kept as markdown text plus its filing metadata; parsing
individual line items out of the markdown is a later step for the
valuation tools (calculate_dcf / calculate_pe) to do against this store.
"""

from pathlib import Path
from typing import List, Optional

import duckdb

import config


class DuckDBManager:
    def __init__(self, db_path=config.DUCKDB_PATH):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = duckdb.connect(db_path)
        self._ensure_schema()

    def _ensure_schema(self):

        # self._conn.execute("DROP TABLE IF EXISTS filing_tables")
        
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS filing_tables (
                id VARCHAR PRIMARY KEY,
                source VARCHAR,
                metadata VARCHAR,
                table_markdown VARCHAR,
                table_csv VARCHAR,
                table_caption VARCHAR,
                page INT,
                bbox_x FLOAT,
                bbox_y FLOAT,
                bbox_w FLOAT,
                bbox_h FLOAT
            )
            """
        )
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS document_pages (
                source VARCHAR,
                page INT,
                width FLOAT,
                height FLOAT,
                PRIMARY KEY (source, page)
            )
            """
        )

    def save_tables(self, source: str, metadata, tables: List) -> int:
        if not tables:
            return 0
        rows = [
            (
                f"{Path(source).stem}_t{i}",
                source,
                metadata,
                table.markdown,
                table.csv,
                table.caption,
                table.page,
                table.bbox_x,
                table.bbox_y,
                table.bbox_w,
                table.bbox_h
            )
            for i, table in enumerate(tables)
        ]
        self._conn.executemany(
            "INSERT OR REPLACE INTO filing_tables VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows
        )
        return len(rows)

    
    def query_tables(self, source: Optional[str] = None, caption_contains: Optional[str] = None):
        query = "SELECT * FROM filing_tables WHERE 1=1"
        params = []
        if source:
            query += " AND source = ?"
            params.append(source)
        if caption_contains:
            query += " AND table_caption ILIKE ?"
            params.append(f"%{caption_contains}%")
        return self._conn.execute(query, params).fetchdf()
        

    def delete_by_source(self, source: str) -> None:
        self._conn.execute("DELETE FROM filing_tables WHERE source = ?", [source])
        self._conn.execute("DELETE FROM document_pages WHERE source = ?", [source])  

    def clear(self) -> None:
        self._conn.execute("DELETE FROM filing_tables")
        self._conn.execute("DELETE FROM document_pages")

    def save_page_dimensions(self, source: str, pages: List[tuple]) -> int:
        """pages: list of (page_number, width, height)."""
        if not pages:
            return 0
        rows = [(source, p, w, h) for p, w, h in pages]
        self._conn.executemany(
            "INSERT OR REPLACE INTO document_pages VALUES (?, ?, ?, ?)", rows
        )

        return len(rows)

    def get_page_dimensions(self, source: str, page: int):
        row = self._conn.execute(
            "SELECT width, height FROM document_pages WHERE source = ? AND page = ?",
            [source, page],
        ).fetchone()
        return {"width": row[0], "height": row[1]} if row else None

    def clear(self) -> None:
        self._conn.execute("DELETE FROM filing_tables")

    def close(self) -> None:
        self._conn.close()
