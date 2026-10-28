import {
  ChatRequest,
  ChatResponse,
  CitationPageImage,
  ClearResponse,
  DeleteResponse,
  DocumentOut,
  JobStatus,
  LLMConfigRequest,
  LLMConfigStatus,
  UploadJobResponse,
} from '../types';

const BASE_URL = '/api';

export const api = {
  /**
   * Send a message to the agentic RAG chat graph.
   * Omit thread_id on first turn; include the returned thread_id on subsequent turns.
   */
  async chat(message: string, threadId?: string): Promise<ChatResponse> {
    const payload: ChatRequest = {
      message: message.trim(),
      ...(threadId ? { thread_id: threadId } : {}),
    };

    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || 'Chat request failed');
    }

    return res.json();
  },

  /**
   * Upload one or more documents (PDF or Markdown) for background ingestion.
   * Returns a job_id immediately with HTTP 202 Accepted.
   */
  async uploadDocuments(files: File[]): Promise<UploadJobResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const res = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || 'Failed to start document upload');
    }

    return res.json();
  },

  /**
   * Poll status of an ingestion job.
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const res = await fetch(`${BASE_URL}/documents/jobs/${encodeURIComponent(jobId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || 'Failed to fetch job status');
    }
    return res.json();
  },

  /**
   * List all currently indexed documents.
   */
  async getDocuments(): Promise<DocumentOut[]> {
    const res = await fetch(`${BASE_URL}/documents`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || 'Failed to fetch documents');
    }
    return res.json();
  },

  /**
   * Delete a single document by name, removing its child vectors, parent chunks, and DuckDB tables.
   */
  async deleteDocument(name: string): Promise<DeleteResponse> {
    const res = await fetch(`${BASE_URL}/documents/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || `Failed to delete document '${name}'`);
    }
    return res.json();
  },

  /**
   * Clear all indexed documents, vectors, and tables across Qdrant, DuckDB, and markdown store.
   */
  async clearDocuments(): Promise<ClearResponse> {
    const res = await fetch(`${BASE_URL}/documents/clear`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || 'Failed to clear documents');
    }
    return res.json();
  },

  /**
   * Fetch a rendered page image of a document along with coordinate dimensions.
   */
  async getCitationPageImage(
    source: string,
    page: string | number,
    dpi: number = 150
  ): Promise<CitationPageImage> {
    const res = await fetch(
      `${BASE_URL}/citations/${encodeURIComponent(source)}/pages/${encodeURIComponent(page)}/image?dpi=${dpi}`
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to fetch page image (${res.status})`);
    }

    const pageWidth = parseFloat(res.headers.get('X-Page-Width') || '0');
    const pageHeight = parseFloat(res.headers.get('X-Page-Height') || '0');
    const renderedWidth = parseFloat(res.headers.get('X-Rendered-Width') || '0');
    const renderedHeight = parseFloat(res.headers.get('X-Rendered-Height') || '0');

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    return {
      blobUrl,
      pageWidth,
      pageHeight,
      renderedWidth,
      renderedHeight,
    };
  },

  /**
   * Get current LLM configuration (provider, model, has_api_key).
   */
  async getLLMConfig(): Promise<LLMConfigStatus> {
    const res = await fetch(`${BASE_URL}/config/llm`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || 'Failed to fetch LLM configuration');
    }
    return res.json();
  },

  /**
   * Reconfigure LLM provider and model.
   * Switching providers resets active backend graph state.
   */
  async setLLMConfig(config: LLMConfigRequest): Promise<LLMConfigStatus> {
    const res = await fetch(`${BASE_URL}/config/llm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP error ${res.status}` }));
      throw new Error(err.detail || 'Failed to update LLM configuration');
    }

    return res.json();
  },
};
