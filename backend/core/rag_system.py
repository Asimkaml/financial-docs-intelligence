import os
import uuid
from langchain_ollama import ChatOllama
import config
from db.vector_db_manager import VectorDbManager
from db.parent_store_manager import ParentStoreManager
from db.duckdb_manager import DuckDBManager
from document_chunker import DocumentChunker
from rag_agent.tools import ToolFactory
from rag_agent.graph import create_agent_graph
from core.observability import Observability

class RAGSystem:

    def __init__(self, collection_name=config.CHILD_COLLECTION):
        self.collection_name = collection_name
        self.vector_db = VectorDbManager()
        self.parent_store = ParentStoreManager()
        self.duckdb = DuckDBManager()          # single shared instance
        self.chunker = DocumentChunker()
        self.observability = Observability()
        self.agent_graph = None
        self.thread_id = str(uuid.uuid4())
        self.recursion_limit = config.GRAPH_RECURSION_LIMIT

        # Live LLM selection -- seeded from config.py, changeable at runtime via
        # reconfigure_llm() (see api/routers/config.py). In-memory only: resets
        # to these config.py defaults on every restart, nothing written to disk.
        self.llm_provider = config.LLM_PROVIDER
        self.llm_model = config.GEMINI_MODEL if self.llm_provider == "gemini" else config.LLM_MODEL

    def _build_llm(self):
        if self.llm_provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=self.llm_model,
                temperature=config.LLM_TEMPERATURE,
                max_retries=1,  # fail fast rather than silently burn through RPM on internal retries
            )
        return ChatOllama(
            model=self.llm_model,
            temperature=config.LLM_TEMPERATURE,
            seed=config.LLM_SEED,
        )

    def initialize(self):
        self.vector_db.create_collection(self.collection_name)
        collection = self.vector_db.get_collection(self.collection_name)
        llm = self._build_llm()
        tools = ToolFactory(collection, self.duckdb).create_tools()
        self.agent_graph = create_agent_graph(llm, tools)

    def reconfigure_llm(self, provider: str, model: str, api_key: str = None) -> None:
        """Switch the active LLM and rebuild the agent graph against it.

        create_agent_graph() builds a brand-new InMemorySaver every time it
        runs, so this unavoidably drops every in-progress conversation
        thread -- there is no way to carry old history over to a
        differently-configured graph. A fresh thread_id is issued here so
        the caller doesn't keep trying to resume one that no longer exists.
        """
        if provider not in ("ollama", "gemini"):
            raise ValueError(f"Unsupported LLM provider: {provider}")

        if provider == "gemini" and api_key:
            # ChatGoogleGenerativeAI reads this from the environment at construction
            # time, not from a constructor argument -- so it has to land here.
            os.environ["GOOGLE_API_KEY"] = api_key

        self.llm_provider = provider
        self.llm_model = model
        self.initialize()
        self.thread_id = str(uuid.uuid4())

    def get_config(self):
        cfg = {"configurable": {"thread_id": self.thread_id}, "recursion_limit": self.recursion_limit}
        handler = self.observability.get_handler()
        if handler:
            cfg["callbacks"] = [handler]
        return cfg

    def reset_thread(self):
        try:
            self.agent_graph.checkpointer.delete_thread(self.thread_id)
        except Exception as e:
            print(f"Warning: Could not delete thread {self.thread_id}: {e}")
        self.thread_id = str(uuid.uuid4())
