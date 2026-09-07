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

    def query_tables(self, company: Optional[str] = None, fiscal_period: Optional[str] = None):
        # query = "SELECT * FROM filing_tables WHERE 1=1"
        # params = []
        # if company:
        #     query += " AND company ILIKE ?"
        #     params.append(f"%{company}%")
        # if fiscal_period:
        #     query += " AND fiscal_period = ?"
        #     params.append(fiscal_period)
        # return self._conn.execute(query, params).fetchdf()
        pass
        

    def delete_by_source(self, source: str) -> None:
        self._conn.execute("DELETE FROM filing_tables WHERE source = ?", [source])

    def list_sources(self) -> List[str]:
        return [r[0] for r in self._conn.execute("SELECT DISTINCT source FROM filing_tables").fetchall()]

    def clear(self) -> None:
        self._conn.execute("DELETE FROM filing_tables")

    def close(self) -> None:
        self._conn.close()
