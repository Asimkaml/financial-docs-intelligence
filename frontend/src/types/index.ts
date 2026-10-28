export interface Citation {
  kind: 'table' | 'child_chunk' | 'parent_chunk' | string;
  source: string;
  page?: number | null;
  page_start?: number | null;
  page_end?: number | null;
  parent_id?: string | null;
  caption?: string | null;
  bbox_x?: number | null;
  bbox_y?: number | null;
  bbox_w?: number | null;
  bbox_h?: number | null;
}

export interface CitationPageImage {
  blobUrl: string;
  pageWidth: number;
  pageHeight: number;
  renderedWidth: number;
  renderedHeight: number;
}

export interface ChatRequest {
  message: string;
  thread_id?: string;
}

export interface ChatResponse {
  thread_id: string;
  answer: string;
  sources: string[];
  citations: Citation[];
  needs_clarification: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  citations?: Citation[];
  needsClarification?: boolean;
  isLoading?: boolean;
  error?: string;
}

export interface DocumentOut {
  name: string;
}

export interface UploadJobResponse {
  job_id: string;
  status: 'pending';
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  added: number;
  skipped: number;
  documents: string[];
  error?: string;
}

export interface ClearResponse {
  cleared: boolean;
}

export interface DeleteResponse {
  deleted: string;
  child_chunks: number;
  parent_chunks: number;
  tables: number;
}

export interface LLMConfigStatus {
  provider: 'ollama' | 'gemini';
  model: string;
  has_api_key: boolean;
}

export interface LLMConfigRequest {
  provider: 'ollama' | 'gemini';
  model: string;
  api_key?: string;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}
