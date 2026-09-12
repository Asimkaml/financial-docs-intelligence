from langchain_core.tools import tool
import config
from db.parent_store_manager import ParentStoreManager
from core.execution_logger import log_error, log_tool_end, log_tool_start

class ToolFactory:
    
    def __init__(self, collection, duckdb_manager=None):
        self.collection = collection
        self.parent_store_manager = ParentStoreManager()
        self.duckdb = duckdb_manager
    
    def _search_child_chunks(self, query: str, limit: int = config.DEFAULT_RETRIEVAL_K) -> str:
        """Search document excerpts for evidence related to the user question.

        Use this as the first retrieval step. Results include parent IDs, file
        names, and short child-chunk excerpts. If excerpts are relevant but too
        fragmented to answer confidently, call retrieve_parent_chunks with the
        returned parent_id.
        
        Args:
            query: Focused search query with concrete keywords from the question.
            limit: Maximum number of child chunks to return.
        """
        log_tool_start("search_child_chunks", {"query": query, "limit": limit})
        try:
            results = self.collection.similarity_search(
                query,
                k=limit,
                score_threshold=config.RETRIEVAL_SCORE_THRESHOLD,
            )
            if not results:
                output = "NO_RELEVANT_CHUNKS"
                log_tool_end("search_child_chunks", output)
                return output

            output = config.CHILD_CHUNK_SEPARATOR.join([
                f"Parent ID: {doc.metadata.get('parent_id', '')}\n"
                f"File Name: {doc.metadata.get('source', '')}\n"
                f"Content: {doc.page_content.strip()}"
                for doc in results
            ])
            log_tool_end("search_child_chunks", output)
            return output

        except Exception as e:
            log_error("search_child_chunks", e)
            output = f"RETRIEVAL_ERROR: {str(e)}"
            log_tool_end("search_child_chunks", output)
            return output
    
    def _retrieve_parent_chunks(self, parent_id: str) -> str:
        """Retrieve the full parent chunk for a relevant child search result.

        Use this only after search_child_chunks returns a relevant parent_id and
        the child excerpt needs more surrounding context. Do not call this for
        parent IDs already available in compressed context.
    
        Args:
            parent_id: Parent chunk ID returned by search_child_chunks.
        """
        log_tool_start("retrieve_parent_chunks", {"parent_id": parent_id})
        try:
            parent = self.parent_store_manager.load_content(parent_id)
            if not parent:
                output = "NO_PARENT_DOCUMENT"
                log_tool_end("retrieve_parent_chunks", output)
                return output

            output = (
                f"Parent ID: {parent.get('parent_id', 'n/a')}\n"
                f"File Name: {parent.get('metadata', {}).get('source', 'unknown')}\n"
                f"Content: {parent.get('content', '').strip()}"
            )
            log_tool_end("retrieve_parent_chunks", output)
            return output

        except Exception as e:
            log_error("retrieve_parent_chunks", e)
            output = f"PARENT_RETRIEVAL_ERROR: {str(e)}"
            log_tool_end("retrieve_parent_chunks", output)
            return output

    def _search_filing_tables(self, source: str = None, caption_contains: str = None) -> str:
        """Search structured financial tables extracted from filings (balance sheets,
        income statements, cash flow statements). Use this when the question needs
        exact figures from a table rather than narrative discussion — prefer this over
        search_child_chunks for numeric lookups.

        Note: tables are currently stored as whole blocks, not individual line items —
        this returns full table content matching the filter, for you to read the
        relevant figure from directly.

        Args:
            source: Exact filing filename to restrict results to (e.g. "sys_hf_26.pdf").
            caption_contains: Substring to match against the table's section heading
                (e.g. "profit or loss", "balance sheet"). Case-insensitive.
        """
        log_tool_start("search_filing_tables", {"source": source, "caption_contains": caption_contains})
        try:
            if self.duckdb is None:
                output = "TABLE_STORE_UNAVAILABLE"
                log_tool_end("search_filing_tables", output)
                return output

            df = self.duckdb.query_tables(source=source, caption_contains=caption_contains)
            if df.empty:
                output = "NO_MATCHING_TABLES"
                log_tool_end("search_filing_tables", output)
                return output

            output = config.CHILD_CHUNK_SEPARATOR.join([
                f"File Name: {row['source']}\n"
                f"Section: {row['table_caption']}\n"
                f"Page: {row['page']}\n"
                f"Table:\n{row['table_markdown']}"
                for _, row in df.iterrows()
            ])
            log_tool_end("search_filing_tables", output)
            return output

        except Exception as e:
            log_error("search_filing_tables", e)
            output = f"TABLE_RETRIEVAL_ERROR: {str(e)}"
            log_tool_end("search_filing_tables", output)
            return output

    def create_tools(self) -> list:
        """Create and return the list of tools."""
        search_tool = tool("search_child_chunks")(self._search_child_chunks)
        retrieve_tool = tool("retrieve_parent_chunks")(self._retrieve_parent_chunks)
        table_tool = tool("search_filing_tables")(self._search_filing_tables)

        return [search_tool, retrieve_tool, table_tool]
    
